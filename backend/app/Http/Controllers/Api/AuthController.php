<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use App\Support\Settings;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    /** Step 1: username or email + password. */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);
        $login = trim($data['login']);
        $key = 'login:'.mb_strtolower($login).'|'.$request->ip();
        $max = (int) Settings::get('security.max_login_attempts', 5);
        $lockMinutes = (int) Settings::get('security.lockout_minutes', 15);

        if (RateLimiter::tooManyAttempts($key, $max)) {
            $wait = (int) ceil(RateLimiter::availableIn($key) / 60);
            Audit::failed('auth.login', [], ['username' => $login, 'reason' => 'locked out'], null, 429);

            return response()->json(['message' => "Too many failed attempts. Try again in {$wait} minute".($wait === 1 ? '' : 's').'.'], 429);
        }

        $user = User::query()->where('username', $login)->orWhere('email', $login)->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, $lockMinutes * 60);
            if (RateLimiter::tooManyAttempts($key, $max)) {
                Log::warning('Sign-in locked after repeated failures', ['login' => $login, 'ip' => $request->ip()]);
            }
            Audit::failed('auth.login', $user ? ['type' => 'user', 'id' => $user->id, 'label' => $user->username] : [], ['username' => $login, 'reason' => 'wrong credentials'], $user, 422);

            return response()->json(['message' => 'The username, email or password is incorrect.'], 422);
        }

        if (! $user->is_active) {
            Audit::failed('auth.login', ['type' => 'user', 'id' => $user->id, 'label' => $user->username], ['reason' => 'account disabled'], $user, 403);

            return response()->json(['message' => 'This account is disabled. Ask an administrator to enable it.'], 403);
        }

        RateLimiter::clear($key);

        if ($user->hasTwoFactor()) {
            $request->session()->put('2fa.user_id', $user->id);
            $request->session()->put('2fa.expires', now()->addMinutes(5)->timestamp);

            return response()->json(['two_factor' => true]);
        }

        return $this->complete($request, $user, 'password');
    }

    /** Step 2 (when enabled): 6-digit code or a recovery code. */
    public function twoFactor(Request $request, TwoFactor $tf): JsonResponse
    {
        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:20'],
            'recovery_code' => ['nullable', 'string', 'max:30'],
        ]);
        $id = $request->session()->get('2fa.user_id');
        $expires = (int) $request->session()->get('2fa.expires', 0);
        if (! $id || $expires < now()->timestamp) {
            $request->session()->forget(['2fa.user_id', '2fa.expires']);

            return response()->json(['message' => 'Your sign-in expired. Enter your password again.'], 422);
        }
        $user = User::query()->findOrFail($id);
        $key = '2fa:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            Audit::failed('auth.two_factor', ['type' => 'user', 'id' => $user->id, 'label' => $user->username], ['reason' => 'too many codes'], $user, 429);

            return response()->json(['message' => 'Too many wrong codes. Wait a minute and try again.'], 429);
        }

        $ok = false;
        $method = 'totp';
        if (! empty($data['code'])) {
            $ok = $tf->verify($user, $user->two_factor_secret, $data['code']);
        } elseif (! empty($data['recovery_code'])) {
            $method = 'recovery code';
            $ok = $tf->useRecoveryCode($user, $data['recovery_code']);
        }

        if (! $ok) {
            RateLimiter::hit($key, 60);
            Audit::failed('auth.two_factor', ['type' => 'user', 'id' => $user->id, 'label' => $user->username], ['method' => $method], $user, 422);

            return response()->json(['message' => 'That code is not valid. Check your authenticator app and try again.'], 422);
        }

        RateLimiter::clear($key);
        $request->session()->forget(['2fa.user_id', '2fa.expires']);

        return $this->complete($request, $user, $method);
    }

    public function logout(Request $request): JsonResponse
    {
        Audit::success('auth.logout');
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(static::payload($request->user()));
    }

    private function complete(Request $request, User $user, string $method): JsonResponse
    {
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('last_activity', now()->timestamp);
        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $request->ip()])->save();
        Audit::success('auth.login', ['type' => 'user', 'id' => $user->id, 'label' => $user->username], ['method' => $method], $user);

        return response()->json(static::payload($user));
    }

    public static function payload(User $user): array
    {
        $enforced = Settings::twoFactorEnforced();

        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'display_name' => $user->display_name,
            'role' => $user->role,
            'role_label' => config("fitcheck.roles.{$user->role}", $user->role),
            'permissions' => $user->permissions(),
            'two_factor_enabled' => $user->hasTwoFactor(),
            'two_factor_enforced' => $enforced,
            'must_change_password' => $user->must_change_password,
            'needs_profile' => $user->needsProfile(),
            'needs_two_factor' => $enforced && ! $user->hasTwoFactor(),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'session_timeout_minutes' => (int) Settings::get('security.session_timeout_minutes', 30),
            'password_min_length' => (int) Settings::get('security.password_min_length', 8),
        ];
    }
}

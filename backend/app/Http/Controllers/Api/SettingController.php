<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Settings;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Settings::all());
    }

    public function update(Request $request, TwoFactor $tf): JsonResponse
    {
        $data = $request->validate([
            'security.two_factor_enforced' => ['sometimes', 'boolean'],
            'security.session_timeout_minutes' => ['sometimes', 'integer', 'between:5,720'],
            'security.password_min_length' => ['sometimes', 'integer', 'between:8,64'],
            'security.max_login_attempts' => ['sometimes', 'integer', 'between:3,20'],
            'security.lockout_minutes' => ['sometimes', 'integer', 'between:1,1440'],
            'code' => ['nullable', 'string', 'max:10'],
        ]);
        $user = $request->user();
        $before = Settings::all();
        $new = collect($request->input('security', []))->mapWithKeys(fn ($v, $k) => ["security.{$k}" => $v])
            ->only(array_keys(config('fitcheck.settings')))->all();

        // Turning the global 2FA switch off needs the operator's own code (if they use 2FA).
        $turningOff = array_key_exists('security.two_factor_enforced', $new) && ! $new['security.two_factor_enforced'] && $before['security.two_factor_enforced'];
        if ($turningOff && $user->hasTwoFactor() && ! $tf->verify($user, $user->two_factor_secret, (string) $request->input('code'))) {
            $request->attributes->set('audit', ['action' => 'settings.update', 'meta' => ['changes' => $new, 'reason' => '2FA code missing or wrong']]);

            return response()->json(['message' => 'Enter a valid code from your authenticator app to turn off two-factor sign-in.', 'errors' => ['code' => ['Code required.']]], 422);
        }

        foreach ($new as $k => $v) {
            Settings::set($k, is_bool($before[$k]) ? (bool) $v : (int) $v, $user->id);
        }
        $after = Settings::all();
        $changed = array_filter($new, fn ($v, $k) => $before[$k] != $v, ARRAY_FILTER_USE_BOTH);
        if (array_key_exists('security.two_factor_enforced', $changed)) {
            Log::notice('Global two-factor sign-in '.($after['security.two_factor_enforced'] ? 'turned on' : 'turned off').' by '.$user->username);
        }
        $request->attributes->set('audit', ['action' => 'settings.update', 'target' => ['type' => 'settings', 'label' => implode(', ', array_keys($changed)) ?: 'no change'],
            'meta' => ['before' => array_intersect_key($before, $changed), 'after' => array_intersect_key($after, $changed)]]);

        return response()->json($after);
    }
}

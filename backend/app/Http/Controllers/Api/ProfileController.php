<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Audit;
use App\Support\Settings;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    public static function passwordRule(): Password
    {
        return Password::min((int) Settings::get('security.password_min_length', 8))->mixedCase()->numbers()->symbols();
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'display_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        $before = $user->only(['display_name', 'email']);
        $user->fill($data)->save();
        $request->attributes->set('audit', ['action' => 'profile.update', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username],
            'meta' => ['before' => $before, 'after' => $user->only(['display_name', 'email'])]]);

        return response()->json(AuthController::payload($user));
    }

    public function password(Request $request): JsonResponse
    {
        $user = $request->user();
        $request->validate([
            'current_password' => ['required', 'current_password:web'],
            'password' => ['required', 'confirmed', 'different:current_password', static::passwordRule()],
        ], ['different' => 'Choose a password you have not used just now.']);
        $user->forceFill(['password' => $request->input('password'), 'must_change_password' => false, 'password_changed_at' => now()])->save();
        // Sign out every other session of this user
        DB::table('sessions')->where('user_id', $user->id)->where('id', '!=', $request->session()->getId())->delete();
        $request->attributes->set('audit', ['action' => 'profile.password', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username]]);

        return response()->json(AuthController::payload($user));
    }

    /** Starts enrolment: secret lives in the session until confirmed with a valid code. */
    public function twoFactorStart(Request $request, TwoFactor $tf): JsonResponse
    {
        $user = $request->user();
        $secret = $tf->newSecret();
        $request->session()->put('2fa.setup_secret', $secret);
        $url = $tf->otpauthUrl($user, $secret);
        $request->attributes->set('audit', ['action' => 'profile.two_factor.start', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username]]);

        return response()->json(['secret' => $secret, 'otpauth_url' => $url, 'qr_svg' => $tf->qrSvg($url)]);
    }

    public function twoFactorConfirm(Request $request, TwoFactor $tf): JsonResponse
    {
        $request->validate(['code' => ['required', 'string', 'max:10']]);
        $user = $request->user();
        $secret = $request->session()->get('2fa.setup_secret');
        $request->attributes->set('audit', ['action' => 'profile.two_factor.enable', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username]]);
        if (! $secret) {
            return response()->json(['message' => 'Start the setup again: the QR code expired.'], 422);
        }
        if (! $tf->verify($user, $secret, $request->input('code'))) {
            return response()->json(['message' => 'That code is not valid. Scan the QR code again or wait for a new code.', 'errors' => ['code' => ['That code is not valid.']]], 422);
        }
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()])->save();
        $request->session()->forget('2fa.setup_secret');
        $codes = $tf->newRecoveryCodes($user);

        return response()->json(['recovery_codes' => $codes, 'user' => AuthController::payload($user->fresh())]);
    }

    public function twoFactorDisable(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password:web']]);
        $user = $request->user();
        $request->attributes->set('audit', ['action' => 'profile.two_factor.disable', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username]]);
        if (Settings::twoFactorEnforced()) {
            return response()->json(['message' => 'Two-factor sign-in is required for everyone, so it cannot be turned off.'], 422);
        }
        $user->forceFill(['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null])->save();

        return response()->json(AuthController::payload($user));
    }

    public function recoveryCodes(Request $request, TwoFactor $tf): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password:web']]);
        $user = $request->user();
        $request->attributes->set('audit', ['action' => 'profile.two_factor.recovery_codes', 'target' => ['type' => 'user', 'id' => $user->id, 'label' => $user->username]]);
        if (! $user->hasTwoFactor()) {
            return response()->json(['message' => 'Turn on two-factor sign-in first.'], 422);
        }

        return response()->json(['recovery_codes' => $tf->newRecoveryCodes($user)]);
    }
}

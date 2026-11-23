<?php

namespace App\Http\Middleware;

use App\Support\Settings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks the admin API until the signed-in user has changed the default password,
 * set an email and display name, and (when the global switch is on) set up 2FA.
 */
class EnsureOnboarded
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $steps = array_keys(array_filter([
            'password' => $user->must_change_password,
            'profile' => $user->needsProfile(),
            'two_factor' => Settings::twoFactorEnforced() && ! $user->hasTwoFactor(),
        ]));

        if ($steps) {
            return response()->json([
                'message' => 'Finish setting up your account first.',
                'onboarding' => $steps,
            ], 423);
        }

        return $next($request);
    }
}

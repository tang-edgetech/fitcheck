<?php

namespace App\Http\Middleware;

use App\Support\Audit;
use App\Support\Settings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Signs out disabled accounts and sessions idle longer than the configured timeout. */
class EnforceSessionPolicy
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ! $request->hasSession()) {
            return $next($request);
        }

        $reason = null;
        if (! $user->is_active) {
            $reason = 'This account was disabled.';
        } else {
            $timeout = (int) Settings::get('security.session_timeout_minutes', 30);
            $last = (int) $request->session()->get('last_activity', now()->timestamp);
            if ($timeout > 0 && now()->timestamp - $last > $timeout * 60) {
                $reason = "You were signed out after {$timeout} minutes without activity.";
            }
        }

        if ($reason) {
            Audit::success('auth.session_end', ['type' => 'user', 'id' => $user->id, 'label' => $user->username], ['reason' => $reason], $user);
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['message' => $reason], 401);
        }

        $request->session()->put('last_activity', now()->timestamp);

        return $next($request);
    }
}

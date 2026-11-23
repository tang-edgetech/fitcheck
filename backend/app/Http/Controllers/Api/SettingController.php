<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use App\Support\Settings;
use App\Support\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    /** Setting groups match the tabs in Settings: General, Security, Log, Extra. */
    private const GROUPS = ['general', 'security', 'log', 'extra'];

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->visible($request, Settings::all()));
    }

    public function update(Request $request, TwoFactor $tf): JsonResponse
    {
        $request->validate([
            'general.site_name' => ['sometimes', 'required', 'string', 'max:60'],
            'general.default_view' => ['sometimes', Rule::in(['scroll', 'grid'])],
            'general.default_size' => ['sometimes', Rule::in(['true', 'fill'])],
            'security.two_factor_enforced' => ['sometimes', 'boolean'],
            'security.session_timeout_minutes' => ['sometimes', 'integer', 'between:5,720'],
            'security.password_min_length' => ['sometimes', 'integer', 'between:8,64'],
            'security.max_login_attempts' => ['sometimes', 'integer', 'between:3,20'],
            'security.lockout_minutes' => ['sometimes', 'integer', 'between:1,1440'],
            'log.system_level' => ['sometimes', Rule::in(config('fitcheck.log_levels'))],
            'log.system_retention_days' => ['sometimes', 'integer', 'between:0,3650'],
            'extra.banner_enabled' => ['sometimes', 'boolean'],
            'extra.banner_text' => ['sometimes', 'nullable', 'string', 'max:300'],
            'extra.help_email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'code' => ['nullable', 'string', 'max:10'],
        ]);
        $user = $request->user();
        $before = Settings::all();
        $defaults = config('fitcheck.settings');

        // Flatten {"security": {"lockout_minutes": 10}} into "security.lockout_minutes" => 10, known keys only
        $new = [];
        foreach (self::GROUPS as $group) {
            foreach ((array) $request->input($group, []) as $k => $v) {
                if (array_key_exists("{$group}.{$k}", $defaults)) {
                    $new["{$group}.{$k}"] = $v;
                }
            }
        }
        // Log settings control what the system log keeps, so only people who can read it may change them
        if (collect($new)->keys()->contains(fn ($k) => str_starts_with($k, 'log.'))) {
            abort_unless($user->can('systemlogs.view'), 403, 'Only a Developer can change log settings.');
        }

        // Turning the global 2FA switch off needs the operator's own code (if they use 2FA).
        $turningOff = array_key_exists('security.two_factor_enforced', $new) && ! $new['security.two_factor_enforced'] && $before['security.two_factor_enforced'];
        if ($turningOff && $user->hasTwoFactor() && ! $tf->verify($user, $user->two_factor_secret, (string) $request->input('code'))) {
            $request->attributes->set('audit', ['action' => 'settings.update', 'meta' => ['changes' => $new, 'reason' => '2FA code missing or wrong']]);

            return response()->json(['message' => 'Enter a valid code from your authenticator app to turn off two-factor sign-in.', 'errors' => ['code' => ['Code required.']]], 422);
        }

        foreach ($new as $k => $v) {
            $cast = match (true) {
                is_bool($defaults[$k]) => (bool) $v,
                is_int($defaults[$k]) => (int) $v,
                default => trim((string) ($v ?? '')),
            };
            Settings::set($k, $cast, $user->id);
        }
        $after = Settings::all();
        $changed = array_filter($new, fn ($v, $k) => $before[$k] != $after[$k], ARRAY_FILTER_USE_BOTH);
        if (array_key_exists('security.two_factor_enforced', $changed)) {
            Log::notice('Global two-factor sign-in '.($after['security.two_factor_enforced'] ? 'turned on' : 'turned off').' by '.$user->username);
        }
        if (array_key_exists('log.system_retention_days', $changed) || array_key_exists('log.system_level', $changed)) {
            Log::notice('System log settings changed by '.$user->username, array_intersect_key($after, ['log.system_level' => 1, 'log.system_retention_days' => 1]));
        }
        // The tester reads General and Extra settings through the public endpoint
        PublicController::bust();
        $request->attributes->set('audit', ['action' => 'settings.update', 'target' => ['type' => 'settings', 'label' => implode(', ', array_keys($changed)) ?: 'no change'],
            'meta' => ['before' => array_intersect_key($before, $changed), 'after' => array_intersect_key($after, $changed)]]);

        return response()->json($this->visible($request, $after));
    }

    /** Deletes system log entries older than the retention setting. The audit log is never pruned. */
    public function pruneSystemLog(Request $request): JsonResponse
    {
        $days = (int) Settings::get('log.system_retention_days', 30);
        $deleted = $days > 0 ? static::prune($days) : 0;
        $request->attributes->set('audit', ['action' => 'settings.prune_system_log', 'target' => ['type' => 'system_log', 'label' => "{$deleted} entries"],
            'meta' => ['retention_days' => $days, 'deleted' => $deleted]]);

        return response()->json(['deleted' => $deleted, 'retention_days' => $days]);
    }

    public static function prune(int $days): int
    {
        return SystemLog::query()->where('created_at', '<', now()->subDays($days))->delete();
    }

    /** Admins don't see the Log group (they can't read the system log either). */
    private function visible(Request $request, array $all): array
    {
        return $request->user()->can('systemlogs.view')
            ? $all
            : array_filter($all, fn ($k) => ! str_starts_with($k, 'log.'), ARRAY_FILTER_USE_KEY);
    }
}

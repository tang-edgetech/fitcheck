<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

class Settings
{
    private const CACHE_KEY = 'fitcheck.settings';

    public static function all(): array
    {
        $defaults = config('fitcheck.settings');
        try {
            $stored = Cache::remember(self::CACHE_KEY, 60, fn () => Schema::hasTable('settings')
                ? Setting::query()->pluck('value', 'key')->all()
                : []);
        } catch (Throwable) {
            $stored = [];
        }

        return array_merge($defaults, array_intersect_key($stored, $defaults));
    }

    public static function get(string $key, mixed $fallback = null): mixed
    {
        return static::all()[$key] ?? $fallback;
    }

    public static function set(string $key, mixed $value, ?int $userId = null): void
    {
        Setting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $userId]);
        Cache::forget(self::CACHE_KEY);
    }

    public static function twoFactorEnforced(): bool
    {
        return (bool) static::get('security.two_factor_enforced', false);
    }
}

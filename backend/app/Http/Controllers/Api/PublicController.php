<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\ScreenView;
use Illuminate\Http\JsonResponse;
use App\Support\Settings;
use Illuminate\Support\Facades\Cache;

/** Unauthenticated data for the tester page: active families and their active screen views. */
class PublicController extends Controller
{
    public const CACHE_KEY = 'public.screen_views';

    public function screenViews(): JsonResponse
    {
        $data = Cache::remember(self::CACHE_KEY, 300, function () {
            $families = Family::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')
                ->with(['screenViews' => fn ($q) => $q->where('is_active', true)])
                ->get()
                ->map(fn (Family $f) => [
                    'id' => $f->slug,
                    'name' => $f->name,
                    'is_default' => $f->is_default,
                    'devices' => $f->screenViews->map->toPublic()->values()->all(),
                ])
                ->filter(fn ($f) => count($f['devices']) > 0)
                ->values();

            // Plain arrays only: the cache store refuses to unserialize objects such as Collections
            return [
                'families' => $families->toArray(),
                'all' => ScreenView::query()->where('is_active', true)->orderBy('sort_order')->orderBy('id')->get()->map->toPublic()->values()->toArray(),
            ];
        });

        // General and Extra settings the tester uses (not cached here: Settings has its own short cache)
        $s = Settings::all();
        $data['site'] = [
            'name' => $s['general.site_name'],
            'default_view' => $s['general.default_view'],
            'default_size' => $s['general.default_size'],
            'banner' => $s['extra.banner_enabled'] && trim((string) $s['extra.banner_text']) !== '' ? $s['extra.banner_text'] : null,
            'help_email' => $s['extra.help_email'] ?: null,
        ];

        return response()->json($data)->header('Cache-Control', 'public, max-age=60');
    }

    public static function bust(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}

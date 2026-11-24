<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\ScreenView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
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

    /**
     * Does this site allow being shown inside another site (the tester's frames)?
     * Reads only the response headers: X-Frame-Options and Content-Security-Policy frame-ancestors.
     * Public addresses only (no private/internal IPs, checked on every redirect), so it can't probe the server's network.
     */
    public function frameCheck(Request $request): JsonResponse
    {
        $data = $request->validate(['url' => ['required', 'string', 'max:2048', 'url:http,https']]);
        $url = $data['url'];
        $key = 'framecheck:'.sha1($url);
        if ($hit = Cache::get($key)) {
            return response()->json($hit);
        }

        $result = ['url' => $url, 'embeddable' => true, 'reason' => null, 'status' => null];
        try {
            for ($hop = 0; $hop < 4; $hop++) {
                if (! static::isPublicHost((string) parse_url($url, PHP_URL_HOST))) {
                    return response()->json(['url' => $url, 'embeddable' => null, 'reason' => 'This address isn\'t a public website.', 'status' => null]);
                }
                $res = Http::withOptions(['allow_redirects' => false, 'stream' => true, 'verify' => true])
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Fitcheck frame check)', 'Accept' => 'text/html'])
                    ->timeout(8)->get($url);
                $result['status'] = $res->status();
                $location = $res->header('Location');
                if ($res->redirect() && $location) {
                    $url = (string) \GuzzleHttp\Psr7\UriResolver::resolve(new \GuzzleHttp\Psr7\Uri($url), new \GuzzleHttp\Psr7\Uri($location));
                    continue;
                }
                $result += static::framingVerdict($res->header('X-Frame-Options'), $res->header('Content-Security-Policy'));
                if (isset($result['blocked_by'])) {
                    $result['embeddable'] = false;
                    $result['reason'] = $result['blocked_by'];
                    unset($result['blocked_by']);
                }
                break;
            }
        } catch (\Throwable) {
            $result = ['url' => $data['url'], 'embeddable' => null, 'reason' => 'The site didn\'t answer the check.', 'status' => null];
        }
        Cache::put($key, $result, now()->addMinutes(10));

        return response()->json($result);
    }

    /** Which header (if any) stops this site from showing inside the tester at FRONTEND_URL. */
    public static function framingVerdict(?string $xfo, ?string $csp): array
    {
        // A CSP frame-ancestors directive overrides X-Frame-Options in current browsers
        if ($csp && preg_match('/(?:^|;)\s*frame-ancestors\s+([^;]*)/i', $csp, $m)) {
            $sources = preg_split('/\s+/', strtolower(trim($m[1])));
            $site = strtolower((string) parse_url((string) config('fitcheck.frontend_url'), PHP_URL_HOST));
            foreach ($sources as $s) {
                $host = preg_replace('#^https?://#', '', rtrim($s, '/'));
                if ($s === '*' || ($site && ($host === $site || (str_starts_with($host, '*.') && str_ends_with($site, substr($host, 1)))))) {
                    return [];
                }
            }

            return ['blocked_by' => 'Content-Security-Policy: frame-ancestors '.trim($m[1])];
        }
        $x = strtoupper(trim((string) $xfo));
        if ($x === 'DENY' || $x === 'SAMEORIGIN' || str_starts_with($x, 'ALLOW-FROM')) {
            return ['blocked_by' => 'X-Frame-Options: '.$x];
        }

        return [];
    }

    private static function isPublicHost(string $host): bool
    {
        if ($host === '' || strcasecmp($host, 'localhost') === 0) {
            return false;
        }
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : array_merge(
            gethostbynamel($host) ?: [],
            array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6'),
        );
        if (! $ips) {
            return false;
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }

        return true;
    }

    public static function bust(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}

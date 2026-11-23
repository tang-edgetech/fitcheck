<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies;

/**
 * Trusts X-Forwarded-* headers only from the Next.js server that proxies /api and /sanctum.
 * The list comes from TRUSTED_PROXIES in .env (via config, so it survives `php artisan config:cache`).
 * Locally that's 127.0.0.1; on cPanel it's the server's own IP, because Next.js reaches the API
 * subdomain through the public address. Without it, every visitor would share the server's IP in
 * the audit log and in sign-in lockouts.
 */
class TrustConfiguredProxies extends TrustProxies
{
    protected function proxies()
    {
        $list = array_values(array_filter(array_map('trim', explode(',', (string) config('fitcheck.trusted_proxies')))));

        return $list ?: ['127.0.0.1', '::1'];
    }
}

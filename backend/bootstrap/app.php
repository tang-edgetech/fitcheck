<?php

use App\Http\Middleware\AuditMutations;
use App\Http\Middleware\EnforceSessionPolicy;
use App\Http\Middleware\EnsureOnboarded;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SkipAudit;
use App\Support\Audit;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Session cookies + CSRF for the Next.js app (same-site SPA auth)
        $middleware->statefulApi();
        // The Next.js dev/prod server proxies /api and /sanctum, so trust its forwarded headers from localhost
        $middleware->trustProxies(at: ['127.0.0.1', '::1']);
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'audit' => AuditMutations::class,
            'audit.skip' => SkipAudit::class,
            'onboarded' => EnsureOnboarded::class,
            'session.policy' => EnforceSessionPolicy::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // Permission denials are security events. Write/delete requests are already audited by the
        // AuditMutations middleware, so record the read-only ones here (one row per denial).
        $exceptions->report(function (AuthorizationException|AccessDeniedHttpException $e) {
            if (in_array(request()->method(), ['GET', 'HEAD'], true)) {
                Audit::failed('access.denied', [], ['reason' => $e->getMessage(), 'route' => request()->route()?->getName()]);
            }
        })->stop();
    })->create();

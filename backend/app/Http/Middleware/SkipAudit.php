<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Marks routes whose controllers write their own audit rows. */
class SkipAudit
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('audit', false);

        return $next($request);
    }
}

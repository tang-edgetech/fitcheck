<?php

namespace App\Http\Middleware;

use App\Support\Audit;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records every create/update/delete request as one audit row with Success or Failed.
 * Controllers can enrich the row by setting $request->attributes 'audit'
 * = ['action' => ..., 'target' => [...], 'meta' => [...]], or 'audit' = false to skip
 * (used where the controller writes its own rows, e.g. sign-in).
 */
class AuditMutations
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $response;
        }
        $extra = $request->attributes->get('audit');
        if ($extra === false) {
            return $response;
        }
        $extra = is_array($extra) ? $extra : [];

        $code = $response->getStatusCode();
        $route = $request->route();
        // Same names whether the request succeeded or failed validation (resource routes: store → create, destroy → delete)
        $action = $extra['action'] ?? preg_replace(['/\.store$/', '/\.destroy$/'], ['.create', '.delete'],
            $route?->getName() ?: strtolower($request->method()).' '.$request->path());

        $target = $extra['target'] ?? [];
        if (! $target && $route) {
            foreach ($route->parameters() as $name => $value) {
                $target = ['type' => $name, 'id' => is_object($value) ? $value->getKey() : $value,
                    'label' => is_object($value) ? ($value->name ?? $value->username ?? null) : null];
                break;
            }
        }

        $meta = $extra['meta'] ?? [];
        if (! isset($meta['after']) && ! isset($meta['input'])) {
            $input = $request->except(['password', 'password_confirmation', 'current_password', 'code', 'recovery_code']);
            if ($input) {
                $meta['input'] = $input;
            }
        }
        if ($code >= 400) {
            $body = $response instanceof JsonResponse ? $response->getData(true) : [];
            $meta['error'] = $body['message'] ?? Response::$statusTexts[$code] ?? 'Error';
            if (! empty($body['errors'])) {
                $meta['errors'] = $body['errors'];
            }
        }

        Audit::record($action, $code < 400 ? 'success' : 'failed', $target, $meta, $request->user(), $code);

        return $response;
    }
}

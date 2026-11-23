<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes append-only audit rows. Each row stores the previous row's hash and its own
 * hash over its content, so an edited or removed row breaks the chain (see verify()).
 */
class Audit
{
    private const SECRET_KEYS = '/pass|secret|token|code|recovery|otp/i';

    public static function success(string $action, array $target = [], array $meta = [], ?User $user = null, int $httpStatus = 200): void
    {
        static::record($action, 'success', $target, $meta, $user, $httpStatus);
    }

    public static function failed(string $action, array $target = [], array $meta = [], ?User $user = null, ?int $httpStatus = null): void
    {
        static::record($action, 'failed', $target, $meta, $user, $httpStatus);
    }

    /**
     * @param  array{type?:string,id?:string|int,label?:string}  $target
     */
    public static function record(string $action, string $status, array $target = [], array $meta = [], ?User $user = null, ?int $httpStatus = null): void
    {
        try {
            $request = request();
            $user ??= $request?->user();

            $row = [
                'user_id' => $user?->id,
                'username' => $user?->username ?? ($meta['username'] ?? null),
                'action' => $action,
                'status' => $status === 'success' ? 'success' : 'failed',
                'target_type' => $target['type'] ?? null,
                'target_id' => isset($target['id']) ? (string) $target['id'] : null,
                'target_label' => isset($target['label']) ? Str::limit((string) $target['label'], 250) : null,
                'method' => $request?->method(),
                'path' => $request ? Str::limit('/'.$request->path(), 250) : null,
                'http_status' => $httpStatus,
                'ip' => $request?->ip(),
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 500) : null,
                'meta' => static::clean($meta) ?: null,
                'created_at' => now(),
            ];

            DB::transaction(function () use ($row) {
                $prev = AuditLog::query()->orderByDesc('id')->lockForUpdate()->value('hash');
                $row['prev_hash'] = $prev;
                $row['hash'] = static::hash($row);
                AuditLog::query()->insert(array_merge($row, ['meta' => $row['meta'] ? json_encode($row['meta']) : null]));
            });
        } catch (Throwable $e) {
            // Never let auditing break the request, but make sure the failure is visible.
            logger()->error('Audit log write failed: '.$e->getMessage(), ['action' => $action]);
        }
    }

    public static function hash(array $row): string
    {
        $fields = Arr::only($row, ['user_id', 'username', 'action', 'status', 'target_type', 'target_id', 'method', 'path', 'ip', 'prev_hash']);
        $fields['user_id'] = isset($fields['user_id']) ? (int) $fields['user_id'] : null;
        $fields['meta'] = $row['meta'] ?? null;
        $fields['created_at'] = $row['created_at'] instanceof \DateTimeInterface ? $row['created_at']->format('Y-m-d H:i:s') : (string) $row['created_at'];

        return hash_hmac('sha256', json_encode($fields), (string) config('app.key'));
    }

    /** Remove secrets and oversized values before storing request data. */
    public static function clean(mixed $data, int $depth = 0): mixed
    {
        if (! is_array($data)) {
            return is_string($data) ? Str::limit($data, 500) : $data;
        }
        if ($depth > 4) {
            return '[nested]';
        }
        $out = [];
        foreach ($data as $k => $v) {
            if (is_string($k) && preg_match(self::SECRET_KEYS, $k)) {
                $out[$k] = '[hidden]';

                continue;
            }
            $out[$k] = static::clean($v, $depth + 1);
        }

        return $out;
    }

    /** Recompute the chain; returns the id of the first broken row, or null if intact. */
    public static function verify(): ?int
    {
        $prev = null;
        foreach (AuditLog::query()->orderBy('id')->lazy(500) as $log) {
            $row = $log->getAttributes();
            $row['meta'] = $log->meta;
            if ($log->prev_hash !== $prev || ! hash_equals($log->hash, static::hash($row))) {
                return $log->id;
            }
            $prev = $log->hash;
        }

        return null;
    }
}

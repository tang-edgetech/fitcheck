<?php

namespace App\Logging;

use App\Models\SystemLog;
use Illuminate\Support\Str;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\Logger;
use Monolog\LogRecord;
use Throwable;

class DatabaseHandler extends AbstractProcessingHandler
{
    private static bool $writing = false;

    protected function write(LogRecord $record): void
    {
        if (self::$writing) {
            return; // a failure while logging must not log again
        }
        self::$writing = true;
        try {
            // Settings > Log > lowest level to keep (the channel's LOG_DB_LEVEL is the floor)
            $min = Level::fromName((string) \App\Support\Settings::get('log.system_level', 'info'));
            if ($record->level->isLowerThan($min)) {
                return;
            }
            $context = $record->context;
            if (isset($context['exception']) && $context['exception'] instanceof Throwable) {
                $e = $context['exception'];
                $context['exception'] = [
                    'class' => get_class($e),
                    'file' => $e->getFile().':'.$e->getLine(),
                    'trace' => array_slice(explode("\n", $e->getTraceAsString()), 0, 15),
                ];
            }
            $request = app()->runningInConsole() ? null : request();
            SystemLog::query()->create([
                'level' => strtolower($record->level->getName()),
                'channel' => $record->channel,
                'message' => Str::limit($record->message, 4000),
                'context' => $context ?: null,
                'url' => $request ? Str::limit($request->fullUrl(), 250) : 'console',
                'ip' => $request?->ip(),
                'user_id' => $request?->user()?->id,
                'created_at' => now(),
            ]);
        } catch (Throwable) {
            // database unavailable: the daily file channel still has the entry
        } finally {
            self::$writing = false;
        }
    }
}

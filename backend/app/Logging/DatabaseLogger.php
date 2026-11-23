<?php

namespace App\Logging;

use App\Models\SystemLog;
use Illuminate\Support\Str;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level;
use Monolog\Logger;
use Monolog\LogRecord;
use Throwable;

/** Custom log channel that writes application logs to the system_logs table. */
class DatabaseLogger
{
    public function __invoke(array $config): Logger
    {
        return new Logger('database', [new DatabaseHandler(Level::fromName($config['level'] ?? 'info'))]);
    }
}

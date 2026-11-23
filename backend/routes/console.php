<?php

use Illuminate\Foundation\Inspiring;
use App\Http\Controllers\Api\SettingController;
use App\Support\Settings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Deletes system log entries older than Settings > Log > retention. Runs daily once the scheduler is set up
// (cron: * * * * * php artisan schedule:run). The audit log is never pruned.
Artisan::command('fitcheck:prune-system-log', function () {
    $days = (int) Settings::get('log.system_retention_days', 30);
    $deleted = $days > 0 ? SettingController::prune($days) : 0;
    $this->info($days > 0 ? "Deleted {$deleted} system log entries older than {$days} days." : 'Retention is 0 (keep forever). Nothing deleted.');
})->purpose('Delete old system log entries');

Schedule::command('fitcheck:prune-system-log')->dailyAt('03:15');

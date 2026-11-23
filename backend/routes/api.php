<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FamilyController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\ScreenViewController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\SystemLogController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public: data for the tester page
Route::get('public/screen-views', [PublicController::class, 'screenViews'])->middleware('throttle:120,1')->name('public.screen-views');

// Sign-in (these write their own audit rows)
Route::prefix('auth')->middleware('audit.skip')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:20,1')->name('auth.login');
    Route::post('two-factor', [AuthController::class, 'twoFactor'])->middleware('throttle:20,1')->name('auth.two-factor');
    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->name('auth.logout');
});

Route::middleware(['auth:sanctum', 'session.policy', 'audit', 'throttle:240,1'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');

    // Own account: reachable during first-time setup
    Route::put('profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('profile/password', [ProfileController::class, 'password'])->name('profile.password');
    Route::post('profile/two-factor', [ProfileController::class, 'twoFactorStart'])->name('profile.two-factor.start');
    Route::post('profile/two-factor/confirm', [ProfileController::class, 'twoFactorConfirm'])->name('profile.two-factor.confirm');
    Route::delete('profile/two-factor', [ProfileController::class, 'twoFactorDisable'])->name('profile.two-factor.disable');
    Route::post('profile/two-factor/recovery-codes', [ProfileController::class, 'recoveryCodes'])->name('profile.two-factor.recovery-codes');

    // Everything else needs a finished account setup
    Route::middleware('onboarded')->group(function () {
        Route::get('dashboard', DashboardController::class)->middleware('can:dashboard.view')->name('dashboard');

        Route::middleware('can:screenviews.manage')->group(function () {
            Route::post('screen-views/bulk', [ScreenViewController::class, 'bulk'])->name('screenviews.bulk');
            Route::apiResource('screen-views', ScreenViewController::class)->parameters(['screen-views' => 'screenView'])->names('screenviews');
        });

        Route::middleware('can:families.manage')->group(function () {
            Route::post('families/reorder', [FamilyController::class, 'reorder'])->name('families.reorder');
            Route::apiResource('families', FamilyController::class)->except('show')->names('families');
        });

        Route::middleware('can:users.manage')->group(function () {
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
            Route::post('users/{user}/reset-two-factor', [UserController::class, 'resetTwoFactor'])->name('users.reset-two-factor');
            Route::apiResource('users', UserController::class)->except('show')->names('users');
        });

        Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('can:audit.view')->name('audit.index');
        Route::get('audit-logs/verify', [AuditLogController::class, 'verify'])->middleware('can:audit.view')->name('audit.verify');
        Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show'])->middleware('can:audit.view')->name('audit.show');
        Route::post('audit-logs/export', [AuditLogController::class, 'export'])->middleware('can:audit.export')->name('audit.export');

        Route::get('system-logs', [SystemLogController::class, 'index'])->middleware('can:systemlogs.view')->name('systemlogs.index');

        Route::get('settings', [SettingController::class, 'show'])->middleware('can:settings.manage')->name('settings.show');
        Route::put('settings', [SettingController::class, 'update'])->middleware('can:settings.manage')->name('settings.update');
    });
});

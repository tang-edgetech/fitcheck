<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Family;
use App\Models\ScreenView;
use App\Models\SystemLog;
use App\Models\User;
use App\Support\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $day = now()->subDay();
        $users = User::query()->get(['id', 'is_active', 'two_factor_confirmed_at', 'must_change_password']);

        return response()->json([
            'screen_views' => ['total' => ScreenView::query()->count(), 'active' => ScreenView::query()->where('is_active', true)->count(),
                'by_type' => ScreenView::query()->where('is_active', true)->selectRaw('type, count(*) as n')->groupBy('type')->pluck('n', 'type')],
            'families' => ['total' => Family::query()->count(), 'active' => Family::query()->where('is_active', true)->count()],
            'users' => ['total' => $users->count(), 'active' => $users->where('is_active', true)->count(),
                'two_factor' => $users->whereNotNull('two_factor_confirmed_at')->count(),
                'pending_setup' => $users->where('must_change_password', true)->count()],
            'security' => [
                'two_factor_enforced' => Settings::twoFactorEnforced(),
                'failed_logins_24h' => AuditLog::query()->whereIn('action', ['auth.login', 'auth.two_factor'])->where('status', 'failed')->where('created_at', '>=', $day)->count(),
                'failed_actions_24h' => AuditLog::query()->where('status', 'failed')->where('created_at', '>=', $day)->count(),
                'errors_24h' => $request->user()->can('systemlogs.view')
                    ? SystemLog::query()->whereIn('level', ['error', 'critical', 'alert', 'emergency'])->where('created_at', '>=', $day)->count() : null,
            ],
            'recent' => AuditLog::query()->orderByDesc('id')->limit(8)->get(['id', 'created_at', 'username', 'action', 'status', 'target_label']),
        ]);
    }
}

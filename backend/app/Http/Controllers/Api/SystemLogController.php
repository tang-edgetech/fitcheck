<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = SystemLog::query();
        if ($lv = $request->query('level')) {
            $q->whereIn('level', (array) $lv);
        }
        if ($s = trim((string) $request->query('q'))) {
            $q->where(fn ($w) => $w->where('message', 'like', "%{$s}%")->orWhere('url', 'like', "%{$s}%"));
        }
        if ($from = $request->query('from')) {
            $q->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('created_at', '<=', $to);
        }
        $page = $q->orderByDesc('id')->paginate(min(200, max(10, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => $page->items(),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'counts' => SystemLog::query()->where('created_at', '>=', now()->subDay())->selectRaw('level, count(*) as n')->groupBy('level')->pluck('n', 'level'),
        ]);
    }
}

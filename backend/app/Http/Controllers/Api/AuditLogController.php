<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    private const COLUMNS = ['id', 'created_at', 'username', 'action', 'status', 'target_type', 'target_id', 'target_label', 'method', 'path', 'http_status', 'ip', 'user_agent', 'meta'];

    public function index(Request $request): JsonResponse
    {
        $page = $this->filtered($request)->orderByDesc('id')->paginate(min(200, max(10, (int) $request->query('per_page', 50))));

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditLog $l) => $l->makeHidden(['hash', 'prev_hash'])),
            'total' => $page->total(),
            'page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'actions' => AuditLog::query()->distinct()->orderBy('action')->pluck('action'),
        ]);
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        return response()->json($auditLog);
    }

    /** Integrity check of the hash chain. */
    public function verify(): JsonResponse
    {
        $broken = Audit::verify();

        return response()->json(['intact' => $broken === null, 'first_broken_id' => $broken, 'total' => AuditLog::query()->count()]);
    }

    /** Export selected rows (ids) or every row matching the filters, as JSON or CSV. */
    public function export(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'format' => ['required', Rule::in(['json', 'csv'])],
            'ids' => ['nullable', 'array', 'max:10000'],
            'ids.*' => ['integer'],
            'all' => ['sometimes', 'boolean'],
        ]);
        $q = ! empty($data['ids']) ? AuditLog::query()->whereIn('id', $data['ids']) : $this->filtered($request);
        abort_if(empty($data['ids']) && ! $request->boolean('all'), 422, 'Select rows to export, or choose to export all matching rows.');
        $q->orderByDesc('id')->select(self::COLUMNS);
        $count = (clone $q)->count();
        $name = 'fitcheck-audit-'.now()->format('Ymd-His').'.'.$data['format'];

        // The export itself is audited
        $request->attributes->set('audit', false);
        Audit::success('audit.export', ['type' => 'audit_log', 'label' => "{$count} rows"],
            ['format' => $data['format'], 'count' => $count, 'ids' => $data['ids'] ?? null, 'filters' => $request->only(['q', 'status', 'action', 'username', 'from', 'to'])]);

        return response()->streamDownload(function () use ($q, $data) {
            $out = fopen('php://output', 'w');
            if ($data['format'] === 'csv') {
                fwrite($out, "\xEF\xBB\xBF"); // so Excel opens UTF-8 correctly
                fputcsv($out, self::COLUMNS);
                foreach ($q->lazyById(500, 'id') as $row) {
                    $vals = array_map(fn ($c) => $c === 'meta' ? json_encode($row->meta) : (string) ($row->{$c} instanceof \DateTimeInterface ? $row->{$c}->toIso8601String() : $row->{$c}), self::COLUMNS);
                    fputcsv($out, array_map([$this, 'csvSafe'], $vals));
                }
            } else {
                fwrite($out, '[');
                $first = true;
                foreach ($q->lazyById(500, 'id') as $row) {
                    fwrite($out, ($first ? '' : ',')."\n".json_encode($row->only(self::COLUMNS), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
                    $first = false;
                }
                fwrite($out, "\n]\n");
            }
            fclose($out);
        }, $name, ['Content-Type' => $data['format'] === 'csv' ? 'text/csv; charset=UTF-8' : 'application/json']);
    }

    /** Stops spreadsheet formula injection in exported cells. */
    private function csvSafe(string $v): string
    {
        return preg_match('/^[=+\-@\t\r]/', $v) ? "'".$v : $v;
    }

    private function filtered(Request $request): Builder
    {
        $q = AuditLog::query();
        if ($s = trim((string) $request->input('q'))) {
            $q->where(fn ($w) => $w->where('username', 'like', "%{$s}%")->orWhere('action', 'like', "%{$s}%")
                ->orWhere('target_label', 'like', "%{$s}%")->orWhere('ip', 'like', "%{$s}%"));
        }
        if (in_array($request->input('status'), ['success', 'failed'], true)) {
            $q->where('status', $request->input('status'));
        }
        if ($a = $request->input('action')) {
            $q->whereIn('action', (array) $a);
        }
        if ($u = $request->input('username')) {
            $q->where('username', $u);
        }
        if ($from = $request->input('from')) {
            $q->where('created_at', '>=', $from);
        }
        if ($to = $request->input('to')) {
            $q->where('created_at', '<=', $to);
        }

        return $q;
    }
}

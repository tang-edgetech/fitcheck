<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Settings > Log > Deploys: what the cron job deploy/deploy.sh last did.
 * deploy.sh writes storage/app/deploy/last-check.json (every run) and runs.jsonl (each deploy), via deploy/record.php.
 */
class DeployLogController extends Controller
{
    public function index(): JsonResponse
    {
        $dir = storage_path('app/deploy');
        $check = is_file("$dir/last-check.json") ? json_decode((string) file_get_contents("$dir/last-check.json"), true) : null;

        $runs = [];
        if (is_file("$dir/runs.jsonl")) {
            foreach (array_reverse(file("$dir/runs.jsonl", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) as $line) {
                if (is_array($row = json_decode($line, true))) {
                    $runs[] = $row;
                }
                if (count($runs) >= 30) {
                    break;
                }
            }
        }

        return response()->json([
            'check' => is_array($check) ? $check : null,
            'runs' => $runs,
            'repo' => static::repo(),
        ]);
    }

    /** Branch and commit of the git copy the app runs from, read straight from .git (no shell needed). */
    private static function repo(): ?array
    {
        $git = dirname(base_path()).'/.git';
        if (! is_file("$git/HEAD")) {
            return null;
        }
        $head = trim((string) file_get_contents("$git/HEAD"));
        if (! str_starts_with($head, 'ref: ')) {
            return ['branch' => null, 'commit' => substr($head, 0, 7)];
        }
        $ref = substr($head, 5);
        $hash = is_file("$git/$ref") ? trim((string) file_get_contents("$git/$ref")) : null;
        if (! $hash && is_file("$git/packed-refs")) {
            foreach (file("$git/packed-refs", FILE_IGNORE_NEW_LINES) as $line) {
                if (str_ends_with($line, " $ref")) {
                    $hash = strtok($line, ' ');
                }
            }
        }

        return ['branch' => basename($ref), 'commit' => $hash ? substr($hash, 0, 7) : null];
    }
}

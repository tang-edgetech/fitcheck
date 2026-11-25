<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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
            'repo' => $repo = static::repo(),
            'github' => static::github($check['branch'] ?? $repo['branch'] ?? null),
        ]);
    }

    /**
     * The newest commit on GitHub right now, so Refresh shows a push straight away (the cron job only looks every 15 minutes).
     * Public repositories only (no token); kept for a minute to stay well inside GitHub's 60 requests an hour. Null if it can't tell.
     */
    private static function github(?string $branch): ?array
    {
        $config = dirname(base_path()).'/.git/config';
        if (! $branch || ! is_file($config)
            || ! preg_match('~\[remote "origin"\][^\[]*?url\s*=\s*\S*github\.com[:/]([\w.-]+)/([\w.-]+?)(?:\.git)?\s~', (string) file_get_contents($config), $m)) {
            return null;
        }

        return Cache::remember("deploy:github:$m[1]/$m[2]/$branch", 60, function () use ($m, $branch) {
            try {
                $res = Http::timeout(5)->withHeaders(['Accept' => 'application/vnd.github+json', 'User-Agent' => 'fitcheck-deploy-log'])
                    ->get("https://api.github.com/repos/$m[1]/$m[2]/commits/".rawurlencode($branch));
                $c = $res->successful() ? $res->json() : null;

                return ['commit' => isset($c['sha']) ? [
                    'hash' => substr($c['sha'], 0, 7),
                    'date' => $c['commit']['committer']['date'] ?? null,
                    'author' => $c['commit']['author']['name'] ?? '',
                    'subject' => mb_substr(strtok((string) ($c['commit']['message'] ?? ''), "\n") ?: '', 0, 200),
                ] : null];
            } catch (\Throwable) {
                return ['commit' => null];
            }
        })['commit'];
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

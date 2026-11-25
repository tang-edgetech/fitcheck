<?php
/**
 * Writes deploy.sh results where the admin panel can read them (Settings > Log > Deploys).
 * Called by deploy.sh with PHP CLI, so the JSON is always valid whatever the commit messages contain.
 *
 *   php record.php check <dir>   → <dir>/last-check.json   (every cron run: when it last looked, what it found)
 *   php record.php run <dir>     → appends one line to <dir>/runs.jsonl (each real deploy, success or failure; last 100 kept)
 *
 * Values come from FC_* environment variables set by deploy.sh. No secrets are written.
 */
[$_, $mode, $dir] = $argv + [null, null, null];
if (! in_array($mode, ['check', 'run'], true) || ! $dir) {
    fwrite(STDERR, "usage: php record.php check|run <dir>\n");
    exit(2);
}
if (! is_dir($dir) && ! @mkdir($dir, 0775, true)) {
    fwrite(STDERR, "record.php: can't create $dir\n");
    exit(0); // never fail a deploy because of the record
}

$env = fn (string $k, $default = null) => ($v = getenv($k)) === false || $v === '' ? $default : $v;
/** "hash|date|author|subject" lines from git log */
$commits = function (?string $text) {
    $out = [];
    foreach (preg_split('/\R/', (string) $text) as $line) {
        $p = explode("\x1f", $line, 4);
        if (count($p) === 4) {
            $out[] = ['hash' => $p[0], 'date' => $p[1], 'author' => $p[2], 'subject' => mb_substr($p[3], 0, 200)];
        }
    }

    return $out;
};
$head = $commits($env('FC_HEAD_COMMIT'))[0] ?? null;
$now = date(DATE_ATOM);

if ($mode === 'check') {
    $data = [
        'checked_at' => $now,
        'result' => $env('FC_RESULT', 'up-to-date'), // up-to-date | new-commits | fetch-failed
        'message' => $env('FC_MESSAGE'),
        'branch' => $env('FC_BRANCH'),
        'head' => $head,
        'remote' => $commits($env('FC_REMOTE_COMMIT'))[0] ?? null,
    ];
    file_put_contents("$dir/last-check.json.tmp", json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    rename("$dir/last-check.json.tmp", "$dir/last-check.json");
    exit(0);
}

$started = (int) $env('FC_STARTED', time());
$row = [
    'started_at' => date(DATE_ATOM, $started),
    'finished_at' => $now,
    'seconds' => time() - $started,
    'result' => $env('FC_RESULT', 'success'), // success | failed
    'failed_step' => $env('FC_STEP'),
    'exit_code' => $env('FC_EXIT') !== null ? (int) $env('FC_EXIT') : null,
    'trigger' => $env('FC_TRIGGER', 'cron'),
    'branch' => $env('FC_BRANCH'),
    'from' => $env('FC_FROM'),
    'to' => $env('FC_TO'),
    'parts' => array_values(array_filter(explode(' ', (string) $env('FC_PARTS', '')))),
    'note' => $env('FC_NOTE'),
    'commits' => array_slice($commits($env('FC_COMMITS')), 0, 20),
    'head' => $head,
    'log_tail' => $env('FC_LOG_TAIL') !== null ? mb_substr($env('FC_LOG_TAIL'), -4000) : null,
];
$file = "$dir/runs.jsonl";
$lines = is_file($file) ? array_slice(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), -99) : [];
$lines[] = json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
file_put_contents("$file.tmp", implode("\n", $lines)."\n");
rename("$file.tmp", $file);

// The check above was saved before the pull, so "Running now" would show the old commit until the next cron run: bring it up to date
$checkFile = "$dir/last-check.json";
$check = is_file($checkFile) ? json_decode((string) file_get_contents($checkFile), true) : null;
if (is_array($check) && $head) {
    $check['head'] = $head;
    if ($row['result'] === 'success' && ($check['remote']['hash'] ?? null) === $head['hash']) {
        $check['result'] = 'up-to-date';
        $check['message'] = 'Deployed '.$head['hash'];
    } elseif ($row['result'] === 'failed') {
        $check['message'] = 'Deploy failed at: '.($row['failed_step'] ?? 'unknown step');
    }
    file_put_contents("$checkFile.tmp", json_encode($check, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    rename("$checkFile.tmp", $checkFile);
}

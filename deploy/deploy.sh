#!/usr/bin/env bash
# Fitcheck auto-deploy for cPanel. Meant for cron, e.g. every 5 minutes:
#   */5 * * * * /bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/deploy.sh >/dev/null 2>&1
#
# Each run checks GitHub for new commits on GIT_BRANCH. If there are none it exits quietly.
# Otherwise it updates the clone, then only the parts that changed:
#   backend/  → sync to API_DIR, composer install, migrate (in maintenance mode), cache config and routes
#   frontend/ → npm ci + build:cpanel, sync to WEB_DIR, restart the Node.js app
# and checks the live site. Start, success and failure are posted to Telegram.
#
# Options:
#   --force          deploy both parts even without new commits (use for the first deploy)
#   --dry-run        show what would be deployed, change nothing
#   --api-only / --site-only   limit a forced deploy to one part
# Settings: deploy/deploy.env (see deploy.env.example). Log: $STATE_DIR/deploy.log
# Each run is also recorded for the admin panel (Settings > Log): backend/storage/app/deploy/ (see record.php)

# No -E: the ERR trap fires once in this shell when a ( … ) step fails, not again inside it
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FORCE=0; DRY=0; ONLY=""
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;; --dry-run) DRY=1 ;; --api-only) ONLY=api ;; --site-only) ONLY=site ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option $a" >&2; exit 2 ;;
  esac
done

# One deploy at a time: a cron run that finds another still running just exits
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/deploy.lock"
  flock -n 9 || exit 0
else
  # Fallback lock: a folder (mkdir is atomic); cleared on exit, or after 2 hours if a run died
  LOCK_DIR="$STATE_DIR/deploy.lockdir"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    [[ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]] && rm -rf "$LOCK_DIR" && mkdir "$LOCK_DIR" || exit 0
  fi
  trap 'rm -rf "$LOCK_DIR"' EXIT
fi
for t in git curl; do command -v "$t" >/dev/null || { echo "deploy.sh needs $t" >&2; exit 1; }; done

LOG_FILE="$STATE_DIR/deploy.log"
DEPLOY_THREAD="${TELEGRAM_DEPLOY_THREAD_ID:-$TELEGRAM_THREAD_ID}"
CURRENT_STEP="starting"
MAINTENANCE=0
STARTED=$(date +%s)
TRIGGER=cron; [[ -t 0 ]] && TRIGGER=manual; [[ $FORCE -eq 1 ]] && TRIGGER="$TRIGGER (forced)"

# For the admin panel: record check|run KEY=value…  (never stops the deploy)
RECORD_DIR="$API_DIR/storage/app/deploy"
GIT_FMT='%h%x1f%cI%x1f%an%x1f%s'
record() {
  [[ $DRY -eq 1 ]] && return 0
  local mode="$1"; shift
  env FC_BRANCH="$GIT_BRANCH" FC_HEAD_COMMIT="$(git -C "$SRC_DIR" log -1 --format="$GIT_FMT" 2>/dev/null)" "$@"     $PHP_BIN "$DEPLOY_SCRIPTS_DIR/record.php" "$mode" "$RECORD_DIR" >/dev/null 2>&1 || true
}

cd "$SRC_DIR"
# Never wait for a password from cron: fail instead (set up the deploy key, see the guide)
export GIT_TERMINAL_PROMPT=0
if ! FETCH_ERR=$(git fetch --quiet origin "$GIT_BRANCH" 2>&1); then
  record check FC_RESULT=fetch-failed FC_MESSAGE="git fetch failed: ${FETCH_ERR:0:500}"
  echo "git fetch failed: $FETCH_ERR" >&2
  exit 1
fi

# Your layout: the apps run inside the git copy itself (like C:\xampp\htdocs\fitcheck on a PC):
#   API_DIR = SRC_DIR/backend   and   WEB_DIR = SRC_DIR/frontend/dist-cpanel   → nothing to copy
# Otherwise the folders are separate and get synced.
same_path() { [[ "$(realpath -m "$1")" == "$(realpath -m "$2")" ]]; }
API_IN_PLACE=0; same_path "$API_DIR" "$SRC_DIR/backend" && API_IN_PLACE=1
WEB_IN_PLACE=0; same_path "$WEB_DIR" "$SRC_DIR/frontend/dist-cpanel" && WEB_IN_PLACE=1
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$GIT_BRANCH")

REMOTE_INFO=$(git log -1 --format="$GIT_FMT" "$REMOTE")
if [[ "$LOCAL" == "$REMOTE" ]]; then
  record check FC_RESULT=up-to-date FC_REMOTE_COMMIT="$REMOTE_INFO"
else
  record check FC_RESULT=new-commits FC_REMOTE_COMMIT="$REMOTE_INFO" FC_MESSAGE="$(git rev-list --count "$LOCAL..$REMOTE") new commit(s), deploying"
fi
if [[ "$LOCAL" == "$REMOTE" && $FORCE -eq 0 ]]; then
  exit 0 # nothing new
fi

# Everything from here on is logged
exec > >(tee -a "$LOG_FILE") 2>&1
log "===== Deploy $(git rev-parse --short "$REMOTE") ($GIT_BRANCH) ====="

if [[ "$LOCAL" != "$REMOTE" ]]; then
  CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE")
  COMMITS=$(git log --format='• %h %s (%an)' "$LOCAL..$REMOTE" | head -10)
  COMMITS_REC=$(git log --format="$GIT_FMT" "$LOCAL..$REMOTE" | head -20)
else
  CHANGED=""; COMMITS="(forced redeploy of $(git log -1 --format='%h %s'))"
  COMMITS_REC=$(git log -1 --format="$GIT_FMT")
fi
NOTE=""
DO_API=0; DO_SITE=0
grep -q '^backend/' <<<"$CHANGED" && DO_API=1
grep -qE '^(frontend/|docs/handbook/)' <<<"$CHANGED" && DO_SITE=1
if [[ $FORCE -eq 1 ]]; then
  [[ "$ONLY" != "site" ]] && DO_API=1
  [[ "$ONLY" != "api" ]] && DO_SITE=1
fi
# DEPLOY_SITE=0 in deploy.env: the server doesn't build the site (e.g. not enough memory); upload it by hand instead
if [[ "${DEPLOY_SITE:-1}" == 0 && $DO_SITE -eq 1 ]]; then
  DO_SITE=0; NOTE="Site changed, but DEPLOY_SITE=0: build it locally and upload it."
  log "Site changed, but DEPLOY_SITE=0: build it locally with npm run build:cpanel and upload."
fi

log "Commits:"; log "$COMMITS"
log "Deploy API: $DO_API   Deploy site: $DO_SITE   (API in place: $API_IN_PLACE, site in place: $WEB_IN_PLACE)"
if [[ $DRY -eq 1 ]]; then log "Dry run: nothing changed."; exit 0; fi
if { [[ $DO_API -eq 1 && $API_IN_PLACE -eq 0 ]] || [[ $DO_SITE -eq 1 && $WEB_IN_PLACE -eq 0 ]]; }; then
  command -v rsync >/dev/null || { log "deploy.sh needs rsync to copy into separate app folders"; exit 1; }
fi

SHORT=$(git rev-parse --short "$REMOTE")
parts=(); [[ $DO_API -eq 1 ]] && parts+=("API"); [[ $DO_SITE -eq 1 ]] && parts+=("site")
PARTS="${parts[*]:-nothing (docs only)}"
# What every run record shares
RUN_FIELDS=(FC_STARTED="$STARTED" FC_TRIGGER="$TRIGGER" FC_FROM="$(git rev-parse --short "$LOCAL")" FC_TO="$SHORT"
  FC_PARTS="${parts[*]:-}" FC_COMMITS="$COMMITS_REC" FC_NOTE="$NOTE")

on_error() {
  local code=$?
  if [[ $MAINTENANCE -eq 1 ]]; then (cd "$API_DIR" && $PHP_BIN artisan up) || true; fi
  local tail_log; tail_log=$(tail -n 12 "$LOG_FILE" 2>/dev/null | cut -c1-200)
  tg_send "🔴 <b>Fitcheck deploy failed</b> at step: <b>$(tg_escape "$CURRENT_STEP")</b>
Commit <code>${SHORT}</code> on ${HOST_LABEL} (exit ${code})
<pre>$(tg_escape "$tail_log")</pre>
The previous version keeps running where possible. Fix and push, or run deploy.sh --force." "$DEPLOY_THREAD"
  log "FAILED at: $CURRENT_STEP"
  record run "${RUN_FIELDS[@]}" FC_RESULT=failed FC_STEP="$CURRENT_STEP" FC_EXIT="$code" FC_LOG_TAIL="$(tail -n 40 "$LOG_FILE" 2>/dev/null)"
  exit "$code"
}
trap on_error ERR

step() { CURRENT_STEP="$1"; log "▶ $1"; }

tg_send "🚀 <b>Deploying Fitcheck</b> <code>${SHORT}</code> → ${PARTS}
$(tg_escape "$COMMITS")" "$DEPLOY_THREAD"

step "Update source to origin/$GIT_BRANCH"
git reset --hard --quiet "origin/$GIT_BRANCH"

if [[ $DO_API -eq 1 ]]; then
  if [[ $API_IN_PLACE -eq 1 ]]; then
    # The API runs straight from the git copy (backend/ inside SRC_DIR): git already updated the files.
    # .env, vendor/ and storage/ are git-ignored, so the reset above left them alone.
    step "API files updated in place"
    (cd "$API_DIR" && mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache)
  else
    step "Sync API files"
    # Keeps the server's .env, storage (logs, sessions), vendor and the public .htaccess (it may hold an IP allow-list)
    rsync -a --delete \
      --exclude '.env' --exclude 'storage/' --exclude 'vendor/' --exclude 'bootstrap/cache/*.php' \
      --exclude 'public/.htaccess' --exclude 'node_modules/' --exclude '.well-known/' --exclude 'cgi-bin/' \
      "$SRC_DIR/backend/" "$API_DIR/"
    # storage/ is excluded above so logs and sessions survive; this only adds folders/files that are missing
    # (e.g. on a fresh server), never overwriting what's there
    rsync -a --ignore-existing "$SRC_DIR/backend/storage/" "$API_DIR/storage/"
  fi

  # Only when the PHP packages changed (or vendor/ is missing): downloading packages on shared hosting can be
  # blocked by GitHub. Otherwise the uploaded vendor/ stays as it is and only the class map is refreshed.
  if grep -qx 'backend/composer.lock' <<<"$CHANGED" || [[ ! -f "$API_DIR/vendor/autoload.php" ]]; then
    step "Composer install (packages changed)"
    (cd "$API_DIR" && $COMPOSER_BIN install --no-dev --optimize-autoloader --no-interaction --no-progress)
  else
    step "Refresh autoloader"
    (cd "$API_DIR" && $COMPOSER_BIN dump-autoload --optimize --no-dev --no-interaction)
  fi

  step "Maintenance mode on"
  (cd "$API_DIR" && $PHP_BIN artisan down --retry=30); MAINTENANCE=1

  step "Database migrations"
  (cd "$API_DIR" && $PHP_BIN artisan migrate --force)

  step "Cache config and routes"
  (cd "$API_DIR" && $PHP_BIN artisan config:cache && $PHP_BIN artisan route:cache)

  step "Maintenance mode off"
  (cd "$API_DIR" && $PHP_BIN artisan up); MAINTENANCE=0
fi

if [[ $DO_SITE -eq 1 && "$SITE_MODE" == static ]]; then
  # Hosting without Node.js: build plain files into frontend/out/ (frontend/.htaccess serves them). Nothing to restart.
  step "Build static site"
  (
    # shellcheck disable=SC1090
    [[ -n "${NODE_ACTIVATE:-}" && -f "$NODE_ACTIVATE" ]] && source "$NODE_ACTIVATE"
    cd "$SRC_DIR/frontend"
    npm ci --no-audit --no-fund --loglevel=error
    NO_ZIP=1 NEXT_PUBLIC_API_URL="$API_URL" npm run build:static
  )
elif [[ $DO_SITE -eq 1 ]]; then
  step "Build site"
  (
    # shellcheck disable=SC1090
    [[ -n "${NODE_ACTIVATE:-}" && -f "$NODE_ACTIVATE" ]] && source "$NODE_ACTIVATE"
    cd "$SRC_DIR/frontend"
    npm ci --no-audit --no-fund --loglevel=error
    # Builds into frontend/dist-cpanel/, keeping the .htaccess, tmp/ and .well-known/ cPanel put there
    NO_ZIP=1 BACKEND_URL="$API_URL" npm run build:cpanel
  )

  if [[ $WEB_IN_PLACE -eq 1 ]]; then
    step "Site built in place (frontend/dist-cpanel is the app root)"
  else
    step "Install site files"
    # Keeps Passenger's tmp/ and log, the .htaccess cPanel writes for the app (plus your own lines), and AutoSSL's .well-known/
    rsync -a --delete --exclude 'tmp/' --exclude 'stderr.log' --exclude '.htaccess' --exclude '.well-known/' --exclude 'cgi-bin/' \
      "$SRC_DIR/frontend/dist-cpanel/" "$WEB_DIR/"
  fi

  step "Restart site"
  mkdir -p "$WEB_DIR/tmp" && touch "$WEB_DIR/tmp/restart.txt"
  if command -v cloudlinux-selector >/dev/null 2>&1; then
    cloudlinux-selector restart --json --interpreter nodejs --user "$(whoami)" --app-root "$WEB_APP_ROOT" >/dev/null || true
  fi
fi

# Static hosting: the browser calls the API address directly; with Node.js the site forwards /api itself
API_CHECK_URL=$([[ "$SITE_MODE" == static ]] && echo "$API_URL" || echo "$SITE_URL")
step "Check the live site"
ok=0
for _ in 1 2 3 4 5 6; do
  if curl -fsS --max-time "$HTTP_TIMEOUT" -o /dev/null "$SITE_URL/" \
     && curl -fsS --max-time "$HTTP_TIMEOUT" "$SITE_URL/api/public/screen-views" | grep -q '"families"'; then ok=1; break; fi
  sleep 10
done
[[ $ok -eq 1 ]] || { log "Site or API not answering after deploy"; false; }

trap - ERR
SECS=$(( $(date +%s) - STARTED ))
log "Done in ${SECS}s"
record run "${RUN_FIELDS[@]}" FC_RESULT=success
tg_send "✅ <b>Fitcheck deployed</b> <code>${SHORT}</code> → ${PARTS} in $((SECS / 60))m $((SECS % 60))s
<a href=\"${SITE_URL}\">${SITE_URL#https://}</a> is answering." "$DEPLOY_THREAD"

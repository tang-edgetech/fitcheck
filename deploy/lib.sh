#!/usr/bin/env bash
# Shared helpers for deploy.sh and watchdog.sh: settings, logging and Telegram messages.

DEPLOY_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${FITCHECK_DEPLOY_ENV:-$DEPLOY_SCRIPTS_DIR/deploy.env}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE. Copy deploy.env.example to deploy.env and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$CONFIG_FILE"; set +a

: "${GIT_BRANCH:=main}" "${FAIL_THRESHOLD:=2}" "${SSL_WARN_DAYS:=14}" "${DISK_WARN_PCT:=90}" "${HTTP_TIMEOUT:=20}"
: "${SITE_MODE:=node}" "${STATE_DIR:=$HOME/fitcheck-deploy-state}" "${PHP_BIN:=php}" "${COMPOSER_BIN:=composer}"
mkdir -p "$STATE_DIR"

HOST_LABEL="$(hostname -s 2>/dev/null || echo server)"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# Escape text for Telegram's HTML parse mode
tg_escape() { sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' <<<"$1"; }

# tg_send "<b>html</b> message" [thread_id]
# Sends to the group topic. Without a bot token it only prints (handy when testing).
tg_send() {
  local text="$1" thread="${2:-$TELEGRAM_THREAD_ID}"
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    log "[telegram not configured] $(sed 's/<[^>]*>//g' <<<"$text" | tr '\n' ' ')"
    return 0
  fi
  local args=(-sS --max-time 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}"
    --data-urlencode "text=${text}"
    --data-urlencode "parse_mode=HTML"
    --data-urlencode "disable_web_page_preview=true")
  [[ -n "$thread" ]] && args+=(--data-urlencode "message_thread_id=${thread}")
  local out
  if ! out="$(curl "${args[@]}" 2>&1)" || ! grep -q '"ok":true' <<<"$out"; then
    log "Telegram send failed: $(sed -E 's/bot[0-9]+:[A-Za-z0-9_-]+/bot***/g' <<<"$out")"
    return 1
  fi
}

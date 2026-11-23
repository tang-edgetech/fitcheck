#!/usr/bin/env bash
# Fitcheck watchdog: checks the live site and posts to a Telegram group topic when something breaks
# or recovers. Meant for cron, e.g.:
#   */5 * * * * /bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh >/dev/null 2>&1
#   0 9 * * *   /bin/bash /home/cpadmin99/public_html/fitcheck.smartsitecp.com/deploy/watchdog.sh --report >/dev/null 2>&1
#
# Checks: tester page, admin sign-in page, API through the site, API health (/up), HTTPS certificate
# expiry for both addresses, disk usage, and new errors in the Laravel log.
# A check alerts only after FAIL_THRESHOLD failures in a row, once, then again when it recovers.
#
# Options:
#   --report   also send a status summary (e.g. once a day)
#   --test     send a test message to check the Telegram settings, then exit
# Settings: deploy/deploy.env. Log: $STATE_DIR/watchdog.log

set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

REPORT=0
case "${1:-}" in
  --report) REPORT=1 ;;
  --test) tg_send "🧪 <b>Fitcheck watchdog</b> test message from ${HOST_LABEL}. Alerts will arrive in this topic."; exit $? ;;
  -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
esac

LOG_FILE="$STATE_DIR/watchdog.log"
exec >>"$LOG_FILE" 2>&1
NOW=$(date +%s)
ALERTS=(); RECOVERIES=(); SUMMARY=()

# Records the result of one check and decides whether to alert
#   result <id> <label> <ok:0|1> <detail>
result() {
  local id="$1" label="$2" ok="$3" detail="$4" f="$STATE_DIR/watch.$1"
  local fails=0 since=0 alerted=0
  [[ -f "$f" ]] && read -r fails since alerted <"$f"
  if [[ "$ok" == 1 ]]; then
    if [[ "$alerted" == 1 ]]; then
      local mins=$(( (NOW - since) / 60 ))
      RECOVERIES+=("🟢 <b>$(tg_escape "$label")</b> is back ($(tg_escape "$detail")) after about ${mins} min")
    fi
    echo "0 0 0" >"$f"
    SUMMARY+=("✅ $(tg_escape "$label"): $(tg_escape "$detail")")
  else
    fails=$((fails + 1)); [[ "$since" == 0 ]] && since=$NOW
    if (( fails >= FAIL_THRESHOLD )) && [[ "$alerted" != 1 ]]; then
      ALERTS+=("🔴 <b>$(tg_escape "$label")</b>: $(tg_escape "$detail")"); alerted=1
    fi
    echo "$fails $since $alerted" >"$f"
    SUMMARY+=("❌ $(tg_escape "$label"): $(tg_escape "$detail")")
  fi
  log "$id ok=$ok $detail"
}

# check_http <id> <label> <url> [text the response must contain]
check_http() {
  local id="$1" label="$2" url="$3" must="${4:-}" body code time
  body=$(mktemp)
  read -r code time < <(curl -sS -o "$body" -w '%{http_code} %{time_total}\n' --max-time "$HTTP_TIMEOUT" "$url" 2>/dev/null || echo "000 0")
  local ms; ms=$(awk -v t="$time" 'BEGIN{printf "%d", t*1000}')
  if [[ "$code" =~ ^2 ]] && { [[ -z "$must" ]] || grep -q "$must" "$body"; }; then
    result "$id" "$label" 1 "HTTP $code in ${ms} ms"
  elif [[ "$code" == 000 ]]; then
    result "$id" "$label" 0 "no response (timeout or connection refused)"
  elif [[ "$code" =~ ^2 ]]; then
    result "$id" "$label" 0 "HTTP $code but the response looks wrong"
  else
    result "$id" "$label" 0 "HTTP $code"
  fi
  rm -f "$body"
}

check_ssl() {
  local id="$1" url="$2" host end days
  [[ "$url" == https://* ]] || return 0
  host=${url#https://}; host=${host%%/*}
  end=$(echo | timeout 15 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -z "$end" ]]; then result "$id" "HTTPS certificate ($host)" 0 "could not read the certificate"; return; fi
  days=$(( ($(date -d "$end" +%s) - NOW) / 86400 ))
  if (( days < SSL_WARN_DAYS )); then
    result "$id" "HTTPS certificate ($host)" 0 "expires in $days days. Check AutoSSL in cPanel"
  else
    result "$id" "HTTPS certificate ($host)" 1 "valid for $days more days"
  fi
}

check_disk() {
  local pct
  pct=$(df -P "$HOME" 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')
  [[ -n "$pct" ]] || return 0
  if (( pct >= DISK_WARN_PCT )); then result disk "Disk space" 0 "${pct}% used"; else result disk "Disk space" 1 "${pct}% used"; fi
}

# New ERROR (or worse) lines in today's Laravel log since the last run. Reported straight away, not via result().
check_laravel_log() {
  local file="$API_DIR/storage/logs/laravel-$(date +%F).log" pos_file="$STATE_DIR/watch.logpos" day prev=0 total new first
  [[ -f "$file" ]] || return 0
  [[ -f "$pos_file" ]] && read -r day prev <"$pos_file"
  [[ "${day:-}" == "$(date +%F)" ]] || prev=0
  total=$(wc -l <"$file")
  (( total < prev )) && prev=0
  new=$(tail -n +"$((prev + 1))" "$file" | grep -E '\.(ERROR|CRITICAL|ALERT|EMERGENCY):' || true)
  echo "$(date +%F) $total" >"$pos_file"
  [[ -n "$new" ]] || return 0
  local count; count=$(grep -c . <<<"$new")
  first=$(head -n 1 <<<"$new" | cut -c1-300)
  ALERTS+=("⚠️ <b>${count} new error(s) in the API log</b>
<pre>$(tg_escape "$first")</pre>Details: Admin → System log, or ${file/#$HOME/~}")
}

check_http site "Tester (public site)" "$SITE_URL/"
check_http admin "Admin sign-in page" "$SITE_URL/admin/login"
if [[ "$SITE_MODE" == static ]]; then
  # Static hosting: the site calls the API address directly (with CORS), so check that
  check_http api_proxy "API (device list)" "$API_URL/api/public/screen-views" '"families"'
else
  check_http api_proxy "API through the site" "$SITE_URL/api/public/screen-views" '"families"'
fi
check_http api_up "API health (/up)" "$API_URL/up"
check_ssl ssl_site "$SITE_URL"
check_ssl ssl_api "$API_URL"
check_disk
check_laravel_log

join() { local IFS=$'\n'; echo "$*"; }
if (( ${#ALERTS[@]} )); then
  tg_send "🚨 <b>Fitcheck needs attention</b> (${HOST_LABEL})
$(join "${ALERTS[@]}")
<a href=\"${SITE_URL}\">${SITE_URL#https://}</a>"
fi
if (( ${#RECOVERIES[@]} )); then
  tg_send "$(join "${RECOVERIES[@]}")"
fi
if (( REPORT )); then
  tg_send "📋 <b>Fitcheck daily status</b> (${HOST_LABEL})
$(join "${SUMMARY[@]}")"
fi
exit 0

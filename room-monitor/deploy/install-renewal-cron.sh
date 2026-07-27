#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
renew_script="$project_dir/deploy/renew-ip-certificate.sh"
log_file="$project_dir/certbot-renew.log"
cron_line="17 */12 * * * $renew_script >> $log_file 2>&1"
current_crontab="$(crontab -l 2>/dev/null || true)"

if grep -Fqx "$cron_line" <<< "$current_crontab"; then
  echo "인증서 갱신 일정이 이미 등록되어 있습니다."
  exit 0
fi

{
  if [[ -n "$current_crontab" ]]; then
    printf '%s\n' "$current_crontab"
  fi
  printf '%s\n' "$cron_line"
} | crontab -

echo "12시간 주기 인증서 갱신 일정을 등록했습니다."


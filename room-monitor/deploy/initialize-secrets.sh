#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "사용법: $0 <공인 IP 또는 도메인>" >&2
  exit 1
fi

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ -e .env || -e deploy/credentials.txt ]]; then
  echo ".env 또는 deploy/credentials.txt가 이미 있습니다. 기존 비밀값을 보존하기 위해 중단합니다." >&2
  exit 1
fi

public_host="$1"
api_key="$(openssl rand -hex 32)"
dashboard_password="$(openssl rand -hex 16)"
dashboard_hash="$(
  docker run --rm caddy:2.10-alpine \
    caddy hash-password --plaintext "$dashboard_password"
)"

umask 077
{
  printf 'API_KEY=%s\n' "$api_key"
  printf 'PUBLIC_HOST=%s\n' "$public_host"
  printf 'DASHBOARD_USER=admin\n'
  printf "DASHBOARD_PASSWORD_HASH='%s'\n" "$dashboard_hash"
} > .env

{
  printf 'Dashboard URL: https://%s/\n' "$public_host"
  printf 'Dashboard user: admin\n'
  printf 'Dashboard password: %s\n' "$dashboard_password"
  printf 'Device API key: %s\n' "$api_key"
} > deploy/credentials.txt

chmod 600 .env deploy/credentials.txt
echo "배포용 비밀값을 생성했습니다."

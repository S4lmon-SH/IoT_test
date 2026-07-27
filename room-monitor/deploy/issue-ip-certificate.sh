#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ ! -f .env ]]; then
  echo ".env가 없습니다. initialize-secrets.sh를 먼저 실행하세요." >&2
  exit 1
fi

public_host="$(
  sed -n 's/^PUBLIC_HOST=//p' .env | head -n 1 | tr -d "'\""
)"

if [[ -z "$public_host" ]]; then
  echo "PUBLIC_HOST를 찾지 못했습니다." >&2
  exit 1
fi

docker compose --profile certificate run --rm --service-ports certbot \
  certonly \
  --standalone \
  --preferred-profile shortlived \
  --ip-address "$public_host" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

echo "공인 IP 인증서 발급을 완료했습니다."


#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

restart_caddy() {
  docker compose --profile production start caddy
}

docker compose --profile production stop caddy
trap restart_caddy EXIT

docker compose --profile certificate run --rm --service-ports certbot \
  renew \
  --preferred-profile shortlived \
  --non-interactive

echo "인증서 갱신 확인을 완료했습니다."


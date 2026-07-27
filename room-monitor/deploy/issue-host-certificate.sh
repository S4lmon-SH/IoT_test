#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ ! -f .env ]]; then
  echo ".env is missing." >&2
  exit 1
fi

public_host="$(
  sed -n 's/^PUBLIC_HOST=//p' .env | head -n 1 | tr -d "'\""
)"

if [[ -z "$public_host" ]]; then
  echo "PUBLIC_HOST is missing." >&2
  exit 1
fi

restart_caddy() {
  docker compose --profile production start caddy >/dev/null 2>&1 || true
}

docker compose --profile production stop caddy
trap restart_caddy EXIT

docker compose --profile certificate run --rm --service-ports certbot \
  certonly \
  --standalone \
  --domain "$public_host" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

echo "Hostname certificate issued for $public_host."

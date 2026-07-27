#!/usr/bin/env bash
set -euo pipefail

oci_cli() {
  docker exec oci oci "$@"
}

metadata() {
  local path="$1"
  curl -fsS \
    -H "Authorization: Bearer Oracle" \
    "http://169.254.169.254/opc/v2/${path}"
}

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

instance_id="$(metadata instance/id)"
compartment_id="$(metadata instance/compartmentId)"
vnic_json="$(
  oci_cli compute instance list-vnics \
    --instance-id "$instance_id" \
    --output json
)"

vnic_id="$(
  python3 -c 'import json,sys; print(json.loads(sys.argv[1])["data"][0]["id"])' \
    "$vnic_json"
)"
subnet_id="$(
  python3 -c 'import json,sys; print(json.loads(sys.argv[1])["data"][0]["subnet-id"])' \
    "$vnic_json"
)"
vcn_id="$(
  oci_cli network subnet get \
    --subnet-id "$subnet_id" \
    --query 'data."vcn-id"' \
    --raw-output
)"

nsg_id="$(
  oci_cli network nsg list \
    --compartment-id "$compartment_id" \
    --vcn-id "$vcn_id" \
    --display-name "room-monitor-https" \
    --lifecycle-state AVAILABLE \
    --query 'data[0].id' \
    --raw-output
)"

if [[ -z "$nsg_id" || "$nsg_id" == "null" ]]; then
  nsg_id="$(
    oci_cli network nsg create \
      --compartment-id "$compartment_id" \
      --vcn-id "$vcn_id" \
      --display-name "room-monitor-https" \
      --query data.id \
      --raw-output
  )"
  echo "room-monitor-https NSG를 생성했습니다."
else
  echo "기존 room-monitor-https NSG를 사용합니다."
fi

rules_json="$(
  oci_cli network nsg rules list \
    --nsg-id "$nsg_id" \
    --direction INGRESS \
    --output json
)"
if [[ -z "$rules_json" ]]; then
  rules_json='{"data": []}'
fi
has_https_rule="$(
  python3 -c '
import json
import sys

rules = json.loads(sys.argv[1]).get("data", [])
found = False
for rule in rules:
    port_range = (rule.get("tcp-options") or {}).get("destination-port-range") or {}
    minimum = port_range.get("min")
    maximum = port_range.get("max")
    if (
        rule.get("protocol") == "6"
        and rule.get("source") == "0.0.0.0/0"
        and minimum is not None
        and maximum is not None
        and minimum <= 443 <= maximum
    ):
        found = True
        break
print("yes" if found else "no")
' "$rules_json"
)"

if [[ "$has_https_rule" == "no" ]]; then
  oci_cli network nsg rules add \
    --nsg-id "$nsg_id" \
    --security-rules '[
      {
        "direction": "INGRESS",
        "protocol": "6",
        "source": "0.0.0.0/0",
        "sourceType": "CIDR_BLOCK",
        "description": "Room monitor HTTPS",
        "tcpOptions": {
          "destinationPortRange": {"min": 443, "max": 443}
        }
      }
    ]' >/dev/null
  echo "443/TCP 인바운드 규칙을 추가했습니다."
else
  echo "443/TCP 인바운드 규칙이 이미 있습니다."
fi

current_nsgs="$(
  oci_cli network vnic get \
    --vnic-id "$vnic_id" \
    --query 'data."nsg-ids"' \
    --output json
)"
if [[ -z "$current_nsgs" ]]; then
  current_nsgs='[]'
fi
updated_nsgs="$(
  python3 -c '
import json
import sys

items = json.loads(sys.argv[1])
nsg_id = sys.argv[2]
if nsg_id not in items:
    items.append(nsg_id)
print(json.dumps(items))
' "$current_nsgs" "$nsg_id"
)"

if [[ "$updated_nsgs" != "$current_nsgs" ]]; then
  oci_cli network vnic update \
    --vnic-id "$vnic_id" \
    --nsg-ids "$updated_nsgs" \
    --force >/dev/null
  echo "NSG를 인스턴스 VNIC에 연결했습니다."
else
  echo "NSG가 이미 인스턴스 VNIC에 연결되어 있습니다."
fi

echo "Oracle Cloud HTTPS 네트워크 구성이 완료됐습니다."

#!/usr/bin/env bash

set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

request() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_statuses="$4"
  local payload="${5:-}"
  local use_auth="${6:-0}"
  local accept_header="${7:-application/json}"

  local body_file="$tmp_dir/${name}.body"
  local headers_file="$tmp_dir/${name}.headers"
  local correlation_id="${correlation_prefix}-${name}"

  local -a cmd=(
    curl
    -sS
    -X "$method"
    -D "$headers_file"
    -o "$body_file"
    -w "%{http_code}"
    "$url"
    -H "Accept: ${accept_header}"
    -H "X-Correlation-Id: ${correlation_id}"
  )

  if [ "$use_auth" = "1" ]; then
    cmd+=(-H "Authorization: Bearer ${access_token}")
  fi

  if [ -n "$release_smoke_tenant_id" ]; then
    cmd+=(-H "X-Tenant-Id: ${release_smoke_tenant_id}")
  fi

  if [ -n "$payload" ]; then
    cmd+=(-H "Content-Type: application/json" --data "$payload")
  fi

  response_status="$("${cmd[@]}")"
  response_body="$(cat "$body_file")"
  response_correlation_id="$(
    awk 'BEGIN { IGNORECASE = 1 } /^X-Correlation-Id:/ { print $2 }' "$headers_file" | tr -d '\r' | tail -n 1
  )"

  echo "[${name}] ${method} ${url} -> ${response_status} correlation=${response_correlation_id:-$correlation_id}"

  if [[ ",${expected_statuses}," != *",${response_status},"* ]]; then
    echo "[${name}] Unexpected status. Expected ${expected_statuses}, got ${response_status}." >&2
    if [ -n "$response_body" ]; then
      echo "$response_body" >&2
    fi
    exit 1
  fi
}

append_query() {
  local url="$1"
  local query="$2"

  if [ -z "$query" ]; then
    printf '%s' "$url"
    return
  fi

  if [[ "$url" == *\?* ]]; then
    printf '%s&%s' "$url" "$query"
    return
  fi

  printf '%s?%s' "$url" "$query"
}

require_cmd curl
require_cmd node

: "${RELEASE_SMOKE_BASE_URL:?RELEASE_SMOKE_BASE_URL is required.}"
: "${RELEASE_SMOKE_EMAIL:?RELEASE_SMOKE_EMAIL is required.}"
: "${RELEASE_SMOKE_PASSWORD:?RELEASE_SMOKE_PASSWORD is required.}"

release_smoke_base_url="${RELEASE_SMOKE_BASE_URL%/}"
release_smoke_api_base_url="${RELEASE_SMOKE_API_BASE_URL:-${release_smoke_base_url}/api}"
release_smoke_api_base_url="${release_smoke_api_base_url%/}"
release_smoke_web_url="${RELEASE_SMOKE_WEB_URL:-}"
release_smoke_email="$RELEASE_SMOKE_EMAIL"
release_smoke_password="$RELEASE_SMOKE_PASSWORD"
release_smoke_tenant_id="${RELEASE_SMOKE_TENANT_ID:-}"
release_smoke_store_id="${RELEASE_SMOKE_STORE_ID:-}"
release_smoke_release_id="${RELEASE_SMOKE_RELEASE_ID:-manual}"
release_smoke_report_date="${RELEASE_SMOKE_REPORT_DATE:-$(date +%F)}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

correlation_prefix="release-smoke-${release_smoke_release_id//[^a-zA-Z0-9-]/-}-$(date -u +%Y%m%dT%H%M%SZ)"
echo "Release smoke started. releaseId=${release_smoke_release_id} correlationPrefix=${correlation_prefix}"

if [ -n "$release_smoke_web_url" ]; then
  request "web-root" "GET" "${release_smoke_web_url%/}" "200" "" "0" "text/html"
fi

request "health-live" "GET" "${release_smoke_base_url}/health/live" "200"
request "health-ready" "GET" "${release_smoke_base_url}/health/ready" "200"

login_payload="$(node -e 'console.log(JSON.stringify({ email: process.argv[1], password: process.argv[2] }))' \
  "$release_smoke_email" \
  "$release_smoke_password")"
request "login" "POST" "${release_smoke_api_base_url}/v1/auth/login" "200" "$login_payload"
access_token="$(
  printf '%s' "$response_body" | node -e '
    let source = "";
    process.stdin.on("data", chunk => source += chunk);
    process.stdin.on("end", () => {
      const data = JSON.parse(source);
      if (typeof data?.accessToken !== "string" || data.accessToken.length === 0) {
        process.exit(1);
      }
      process.stdout.write(data.accessToken);
    });
  '
)"

catalog_url="${release_smoke_api_base_url}/v1/pos/catalog/snapshot"
shift_url="${release_smoke_api_base_url}/v1/pos/shifts/current"
if [ -n "$release_smoke_store_id" ]; then
  catalog_url="$(append_query "$catalog_url" "storeId=${release_smoke_store_id}")"
  shift_url="$(append_query "$shift_url" "storeId=${release_smoke_store_id}")"
fi

request "catalog" "GET" "$catalog_url" "200" "" "1"
printf '%s' "$response_body" | node -e '
  let source = "";
  process.stdin.on("data", chunk => source += chunk);
  process.stdin.on("end", () => {
    const data = JSON.parse(source);
    if (!data || Array.isArray(data) || typeof data !== "object") {
      process.exit(1);
    }
  });
'

request "current-shift" "GET" "$shift_url" "200,204" "" "1"
if [ "$response_status" = "200" ]; then
  printf '%s' "$response_body" | node -e '
    let source = "";
    process.stdin.on("data", chunk => source += chunk);
    process.stdin.on("end", () => {
      const data = JSON.parse(source);
      if (!data?.id) {
        process.exit(1);
      }
    });
  '
fi

report_url="${release_smoke_api_base_url}/v1/pos/reports/daily-summary?date=${release_smoke_report_date}"
if [ -n "$release_smoke_store_id" ]; then
  report_url="$(append_query "$report_url" "storeId=${release_smoke_store_id}")"
fi
request "daily-summary" "GET" "$report_url" "200" "" "1"
printf '%s' "$response_body" | node -e '
  let source = "";
  process.stdin.on("data", chunk => source += chunk);
  process.stdin.on("end", () => {
    const data = JSON.parse(source);
    if (!data || Array.isArray(data) || typeof data !== "object") {
      process.exit(1);
    }
  });
'

echo "Release smoke completed successfully. correlationPrefix=${correlation_prefix}"

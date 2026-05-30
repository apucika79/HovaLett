#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/prepare-supabase-env.sh [--github-env]

Validates Supabase Management API access and resolves runtime-safe frontend
configuration from these environment variables:
  SUPABASE_ACCESS_TOKEN  Required. Supabase personal/fine-grained access token.
  SUPABASE_PROJECT_REF   Required. Supabase project reference.
  SUPABASE_URL           Optional. Defaults to https://<project-ref>.supabase.co.
  SUPABASE_PUBLISHABLE_KEY Optional. If missing, fetched from the Management API.

With --github-env, resolved values are appended to $GITHUB_ENV for later
GitHub Actions steps. Secrets are masked before they are written.
USAGE
}

write_github_env=false
if [[ "${1:-}" == "--github-env" ]]; then
  write_github_env=true
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
elif [[ $# -gt 0 ]]; then
  usage >&2
  exit 2
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: ${name}" >&2
    exit 1
  fi
}

require_env SUPABASE_ACCESS_TOKEN
require_env SUPABASE_PROJECT_REF
require_command curl
require_command python3

api_base="${SUPABASE_MANAGEMENT_API_BASE:-https://api.supabase.com}"
project_ref="${SUPABASE_PROJECT_REF}"
supabase_url="${SUPABASE_URL:-https://${project_ref}.supabase.co}"
publishable_key="${SUPABASE_PUBLISHABLE_KEY:-}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

request_json() {
  local endpoint="$1"
  local output_file="$2"
  local status_file="${output_file}.status"

  local http_status
  http_status="$(curl -sS -w '%{http_code}' -o "$output_file" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Accept: application/json" \
    "${api_base}${endpoint}")"
  printf '%s' "$http_status" > "$status_file"

  if [[ ! "$http_status" =~ ^2 ]]; then
    echo "Supabase Management API request failed for ${endpoint} (HTTP ${http_status})." >&2
    if [[ -s "$output_file" ]]; then
      python3 - "$output_file" >&2 <<'PY'
import json
import sys
from pathlib import Path
body = Path(sys.argv[1]).read_text(errors="replace")
try:
    parsed = json.loads(body)
except json.JSONDecodeError:
    print(body[:1000])
else:
    for key in ("message", "error", "detail"):
        if parsed.get(key):
            print(f"{key}: {parsed[key]}")
PY
    fi
    exit 1
  fi
}

project_json="${tmp_dir}/project.json"
request_json "/v1/projects/${project_ref}" "$project_json"

if [[ -z "$publishable_key" ]]; then
  keys_json="${tmp_dir}/api-keys.json"
  request_json "/v1/projects/${project_ref}/api-keys?reveal=true" "$keys_json"
  publishable_key="$(python3 - "$keys_json" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
if isinstance(payload, dict):
    candidates = payload.get("api_keys") or payload.get("keys") or payload.get("data") or []
elif isinstance(payload, list):
    candidates = payload
else:
    candidates = []

if isinstance(candidates, dict):
    candidates = list(candidates.values())

normalized = []
for item in candidates:
    if isinstance(item, str):
        normalized.append({"api_key": item})
    elif isinstance(item, dict):
        normalized.append(item)

def value(item, *names):
    for name in names:
        raw = item.get(name)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return ""

def score(item):
    key = value(item, "api_key", "key", "value")
    haystack = " ".join(
        value(item, field).lower()
        for field in ("type", "name", "prefix", "description")
    )
    if key.startswith("sb_publishable_"):
        return 100
    if "publishable" in haystack and key:
        return 90
    if "anon" in haystack and key:
        return 70
    if key.startswith("eyJ"):
        return 50
    return 0

best = sorted(normalized, key=score, reverse=True)
if best and score(best[0]) > 0:
    print(value(best[0], "api_key", "key", "value"))
PY
)"
fi

if [[ -z "$publishable_key" ]]; then
  echo "Could not resolve SUPABASE_PUBLISHABLE_KEY from secrets or the Supabase Management API." >&2
  echo "Add SUPABASE_PUBLISHABLE_KEY as a GitHub secret, or ensure SUPABASE_ACCESS_TOKEN can read project API keys." >&2
  exit 1
fi

mask_secret() {
  local value="$1"
  if [[ -n "$value" && -n "${GITHUB_ACTIONS:-}" ]]; then
    printf '::add-mask::%s\n' "$value"
  fi
}

mask_secret "$SUPABASE_ACCESS_TOKEN"
mask_secret "$publishable_key"

if [[ "$write_github_env" == true ]]; then
  if [[ -z "${GITHUB_ENV:-}" ]]; then
    echo "--github-env requires GITHUB_ENV to be set by GitHub Actions." >&2
    exit 1
  fi
  {
    printf 'SUPABASE_PROJECT_REF=%s\n' "$project_ref"
    printf 'SUPABASE_URL=%s\n' "$supabase_url"
    printf 'SUPABASE_PUBLISHABLE_KEY=%s\n' "$publishable_key"
  } >> "$GITHUB_ENV"
else
  printf 'SUPABASE_PROJECT_REF=%s\n' "$project_ref"
  printf 'SUPABASE_URL=%s\n' "$supabase_url"
  printf 'SUPABASE_PUBLISHABLE_KEY=%s\n' "$publishable_key"
fi

echo "Supabase project access verified for ${project_ref}." >&2

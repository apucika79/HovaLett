#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/configure-supabase-auth-providers.sh [--dry-run]

Enables the OAuth providers listed in AUTH_SOCIAL_PROVIDERS in the target
Supabase project's Auth configuration through the Supabase Management API.

Required:
  SUPABASE_ACCESS_TOKEN  Supabase personal/fine-grained access token.
  SUPABASE_PROJECT_REF   Supabase project reference.

Provider selection:
  AUTH_SOCIAL_PROVIDERS  Comma-separated provider list. Supported here:
                         google, facebook, fb/meta aliases, all.
                         Defaults to google,facebook.

Google credential env aliases (first non-empty wins):
  GOOGLE_OAUTH_CLIENT_ID, GOOGLE_CLIENT_ID,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_CLIENT_SECRET,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET

Facebook credential env aliases (first non-empty wins):
  FACEBOOK_OAUTH_CLIENT_ID, FACEBOOK_CLIENT_ID, FACEBOOK_APP_ID,
  SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID
  FACEBOOK_OAUTH_CLIENT_SECRET, FACEBOOK_CLIENT_SECRET, FACEBOOK_APP_SECRET,
  SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET

Optional:
  SUPABASE_MANAGEMENT_API_BASE Defaults to https://api.supabase.com.
  --dry-run                    Validate inputs and print the payload with
                               secrets redacted without calling the API.
USAGE
}

dry_run=false
case "${1:-}" in
  --dry-run)
    dry_run=true
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  "")
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

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

first_non_empty() {
  local name
  for name in "$@"; do
    if [[ -n "${!name:-}" ]]; then
      printf '%s' "${!name}"
      return 0
    fi
  done
  return 1
}

mask_secret() {
  local value="$1"
  if [[ -n "$value" && -n "${GITHUB_ACTIONS:-}" ]]; then
    printf '::add-mask::%s\n' "$value"
  fi
}

require_env SUPABASE_ACCESS_TOKEN
require_env SUPABASE_PROJECT_REF
require_command curl
require_command python3

api_base="${SUPABASE_MANAGEMENT_API_BASE:-https://api.supabase.com}"
providers_raw="${AUTH_SOCIAL_PROVIDERS:-google,facebook}"

payload_file="$(mktemp)"
response_file="$(mktemp)"
cleanup() {
  rm -f "$payload_file" "$response_file" "${response_file}.status"
}
trap cleanup EXIT

selected_providers="$({
  printf '%s' "$providers_raw" | python3 -c '
import sys
aliases = {"fb": "facebook", "meta": "facebook"}
supported = {"google", "facebook"}
selected = []
for raw in sys.stdin.read().split(","):
    provider = raw.strip().lower()
    if not provider:
        continue
    if provider == "all":
        candidates = ["google", "facebook"]
    else:
        candidates = [aliases.get(provider, provider)]
    for candidate in candidates:
        if candidate in supported and candidate not in selected:
            selected.append(candidate)
print("\n".join(selected))
'
})"

if [[ -z "$selected_providers" ]]; then
  echo "No supported social auth providers selected in AUTH_SOCIAL_PROVIDERS=${providers_raw}. Nothing to configure." >&2
  exit 0
fi

json_args=()
enabled_labels=()
missing=()

while IFS= read -r provider; do
  [[ -n "$provider" ]] || continue
  case "$provider" in
    google)
      client_id="$(first_non_empty GOOGLE_OAUTH_CLIENT_ID GOOGLE_CLIENT_ID SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID || true)"
      client_secret="$(first_non_empty GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_CLIENT_SECRET SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET || true)"
      if [[ -z "$client_id" ]]; then missing+=("GOOGLE_OAUTH_CLIENT_ID"); fi
      if [[ -z "$client_secret" ]]; then missing+=("GOOGLE_OAUTH_CLIENT_SECRET"); fi
      json_args+=("google" "$client_id" "$client_secret")
      enabled_labels+=("Google")
      mask_secret "$client_id"
      mask_secret "$client_secret"
      ;;
    facebook)
      client_id="$(first_non_empty FACEBOOK_OAUTH_CLIENT_ID FACEBOOK_CLIENT_ID FACEBOOK_APP_ID SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID || true)"
      client_secret="$(first_non_empty FACEBOOK_OAUTH_CLIENT_SECRET FACEBOOK_CLIENT_SECRET FACEBOOK_APP_SECRET SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET || true)"
      if [[ -z "$client_id" ]]; then missing+=("FACEBOOK_OAUTH_CLIENT_ID"); fi
      if [[ -z "$client_secret" ]]; then missing+=("FACEBOOK_OAUTH_CLIENT_SECRET"); fi
      json_args+=("facebook" "$client_id" "$client_secret")
      enabled_labels+=("Facebook")
      mask_secret "$client_id"
      mask_secret "$client_secret"
      ;;
  esac
done <<< "$selected_providers"

if (( ${#missing[@]} > 0 )); then
  printf 'Missing OAuth credential environment variables for requested providers: %s\n' "$(IFS=', '; echo "${missing[*]}")" >&2
  echo "Either add the provider credentials as repository/environment secrets or remove the provider from AUTH_SOCIAL_PROVIDERS." >&2
  exit 1
fi

python3 - "$payload_file" "${json_args[@]}" <<'PY'
import json
import sys
from pathlib import Path

out = Path(sys.argv[1])
args = sys.argv[2:]
payload = {}
for i in range(0, len(args), 3):
    provider, client_id, client_secret = args[i:i + 3]
    payload[f"external_{provider}_enabled"] = True
    payload[f"external_{provider}_client_id"] = client_id
    payload[f"external_{provider}_secret"] = client_secret
out.write_text(json.dumps(payload, separators=(",", ":")))
PY

if [[ "$dry_run" == true ]]; then
  python3 - "$payload_file" <<'PY'
import json
import sys
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text())
for key in list(payload):
    if key.endswith(("_secret", "_client_id")):
        payload[key] = "***"
print(json.dumps(payload, indent=2, sort_keys=True))
PY
  echo "Dry run complete. Supabase Auth providers would be configured for: ${enabled_labels[*]}." >&2
  exit 0
fi

mask_secret "$SUPABASE_ACCESS_TOKEN"

http_status="$(curl -sS -w '%{http_code}' -o "$response_file" \
  -X PATCH "${api_base}/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data-binary "@${payload_file}")"
printf '%s' "$http_status" > "${response_file}.status"

if [[ ! "$http_status" =~ ^2 ]]; then
  echo "Supabase Auth provider configuration failed (HTTP ${http_status})." >&2
  if [[ -s "$response_file" ]]; then
    python3 - "$response_file" >&2 <<'PY'
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

echo "Supabase Auth providers configured for ${enabled_labels[*]} on project ${SUPABASE_PROJECT_REF}." >&2

#!/usr/bin/env bash
set -euo pipefail

migration_dir="${1:-supabase/migrations}"

if [[ ! -d "$migration_dir" ]]; then
  echo "Missing migration directory: $migration_dir" >&2
  exit 1
fi

shopt -s nullglob
migrations=("$migration_dir"/*.sql)
if (( ${#migrations[@]} == 0 )); then
  echo "No SQL migrations found in $migration_dir" >&2
  exit 1
fi

previous=""
for migration in "${migrations[@]}"; do
  filename="${migration##*/}"
  if [[ ! "$filename" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: $filename" >&2
    exit 1
  fi
  if [[ -n "$previous" && "$filename" < "$previous" ]]; then
    echo "Migrations are not ordered: $previous, $filename" >&2
    exit 1
  fi
  previous="$filename"

  # Baselines and forward migrations must not remove application data. Comments
  # are stripped first so documentation can still name forbidden statements.
  sql_without_comments="$({ sed -E 's/--.*$//' "$migration"; } | tr '\n' ' ')"
  if grep -Eiq '(^|[[:space:];])(drop[[:space:]]+table|truncate([[:space:]]+table)?|delete[[:space:]]+from)([[:space:];]|$)' <<<"$sql_without_comments"; then
    echo "Destructive SQL statement found in $migration" >&2
    exit 1
  fi

done

printf 'Validated %d non-destructive Supabase migration(s).\n' "${#migrations[@]}"

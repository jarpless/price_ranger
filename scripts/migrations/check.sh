#!/usr/bin/env bash
# Applies supabase/migrations to throwaway LOCAL Postgres databases:
#   1. fresh: the whole chain from init, then the whole chain again (idempotency).
#   2. existing: the chain up to PROD_HEAD, prod-like seed rows, then the pending
#      chain twice, then checks the seed rows survived.
# Never point this at a Supabase project. Usage: scripts/migrations/check.sh [psql connection args]
set -euo pipefail

cd "$(dirname "$0")/../.."
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X "$@")
PROD_HEAD="${PROD_HEAD:-20261015160000}"
mapfile -t ALL < <(ls supabase/migrations/*.sql | sort)

dupes=$(printf '%s\n' "${ALL[@]}" | xargs -n1 basename | cut -d_ -f1 | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "Duplicate migration timestamps: $dupes" >&2
  exit 1
fi

pending=()
applied=()
for file in "${ALL[@]}"; do
  stamp=$(basename "$file" | cut -d_ -f1)
  if [[ "$stamp" > "$PROD_HEAD" ]]; then pending+=("$file"); else applied+=("$file"); fi
done

apply() {
  local db=$1
  shift
  for file in "$@"; do
    "${PSQL[@]}" -d "$db" -f "$file" > /dev/null
  done
}

reset() {
  "${PSQL[@]}" -d postgres -c "drop database if exists $1" -c "create database $1" > /dev/null
  "${PSQL[@]}" -d "$1" -f scripts/migrations/supabase-stub.sql > /dev/null
}

echo "Pending after $PROD_HEAD:"
printf '  %s\n' "${pending[@]##*/}"

reset pr_mig_fresh
apply pr_mig_fresh "${ALL[@]}"
apply pr_mig_fresh "${ALL[@]}"
echo "fresh: full chain applied twice"

reset pr_mig_existing
apply pr_mig_existing "${applied[@]}"
"${PSQL[@]}" -d pr_mig_existing -f scripts/migrations/seed-existing.sql > /dev/null
before=$("${PSQL[@]}" -d pr_mig_existing -At -c "select (select count(*) from funnel_events) || '/' || (select count(*) from guide_quotes) || '/' || (select count(*) from library_items where sku_id is not null) || '/' || (select count(*) from quotes)")
apply pr_mig_existing "${pending[@]}"
apply pr_mig_existing "${pending[@]}"
after=$("${PSQL[@]}" -d pr_mig_existing -At -c "select (select count(*) from funnel_events) || '/' || (select count(*) from guide_quotes) || '/' || (select count(*) from library_items where sku_id is not null) || '/' || (select count(*) from quotes)")
orphans=$("${PSQL[@]}" -d pr_mig_existing -At -c "select count(*) from library_items li where li.sku_id is not null and not exists (select 1 from skus s where s.id = li.sku_id)")
echo "existing: pending chain applied twice; funnel_events/guide_quotes/library_items/quotes before=$before after=$after orphaned sku refs=$orphans"
if [ "$before" != "$after" ] || [ "$orphans" != "0" ]; then
  echo "Existing rows changed" >&2
  exit 1
fi
echo "OK"

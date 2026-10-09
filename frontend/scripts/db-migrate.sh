#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL, once each, in order.
# Usage: npm run db:migrate
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL=${SUPABASE_DB_URL:-$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)}
if [ -z "$DB_URL" ]; then echo "SUPABASE_DB_URL is not set (Supabase > Project Settings > Database > Connection string)." >&2; exit 1; fi
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now()); alter table public.schema_migrations enable row level security;"
for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  if [ "$("${PSQL[@]}" -tAc "select 1 from public.schema_migrations where name = '$name'")" = "1" ]; then
    echo "skip  $name"
  else
    "${PSQL[@]}" -1 -f "$f"
    "${PSQL[@]}" -c "insert into public.schema_migrations (name) values ('$name')"
    echo "apply $name"
  fi
done

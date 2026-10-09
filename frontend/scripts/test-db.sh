#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres and runs the RLS tests.
# Needs Postgres binaries on PATH (initdb, pg_ctl, psql). Usage: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=${LC_ALL:-en_US.UTF-8} LANG=${LANG:-en_US.UTF-8}
TMP=$(mktemp -d)
PORT=${PGTEST_PORT:-54329}
cleanup() { pg_ctl -D "$TMP/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
initdb -D "$TMP/data" -U postgres -A trust >/dev/null
pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP" -l "$TMP/log" start >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -o /dev/null -f supabase/tests/rls.test.sql

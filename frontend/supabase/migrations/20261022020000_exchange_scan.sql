-- The scheduled exchange scan's state: one row with the mirror node cursor, a lease so overlapping runs
-- skip, and the last run's time and error. Only the server (service role) reads or writes it.
create table public.exchange_scan_state (
  id integer primary key default 1 check (id = 1),
  -- Consensus timestamp ("seconds.nanoseconds") of the last exchange event handled.
  cursor text not null,
  lease_until timestamptz,
  last_run_at timestamptz,
  last_error text
);

alter table public.exchange_scan_state enable row level security;

-- Start an hour back: reprocessing recent events is harmless (every step is idempotent).
insert into public.exchange_scan_state (id, cursor)
values (1, to_char(extract(epoch from now() - interval '1 hour')::bigint, 'FM9999999999') || '.000000000');

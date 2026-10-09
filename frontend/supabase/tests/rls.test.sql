-- RLS behaviour tests. Run with scripts/test-db.sh. Any failed assertion raises and aborts.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles are created by the auth trigger';
end $$;

create function pg_temp.act_as(p_sub text, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub, ''), false);
  perform set_config('request.jwt.claim.role', p_role, false);
  execute format('set role %I', p_role);
end $$;

-- User A owns an inventory
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
insert into public.emission_data (id, source, total_emissions)
  values ('10000000-0000-0000-0000-000000000001', 'calculator', 1234.5);

-- A cannot write server-owned tables
do $$ begin
  begin
    insert into public.certificates (user_id, emission_data_id, certificate_id, title, total_emissions, data_hash)
      values (auth.uid(), '10000000-0000-0000-0000-000000000001', 'FORGED', 'x', 1, 'x');
    raise exception 'client inserted a certificate';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A cannot set its own wallet linkage
update public.profiles set wallet_address = '0xabc', display_name = 'Alice' where id = auth.uid();
do $$ begin
  assert (select wallet_address from public.profiles where id = auth.uid()) is null, 'wallet is server-only';
  assert (select display_name from public.profiles where id = auth.uid()) = 'Alice', 'display name is editable';
end $$;

-- B cannot see A's inventory
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
do $$ begin
  assert (select count(*) from public.emission_data) = 0, 'inventories are private';
end $$;

-- Server issues a certificate; it is publicly readable and locks the inventory
reset role;
select pg_temp.act_as(null, 'service_role');
insert into public.certificates (user_id, emission_data_id, certificate_id, title, total_emissions, data_hash)
  values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'GT-TEST', 't', 1234.5, 'h');
update public.profiles set wallet_address = '0xabc' where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select wallet_address from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = '0xabc', 'server can link wallets';
end $$;

reset role;
select pg_temp.act_as(null, 'anon');
do $$ begin
  assert (select count(*) from public.certificates) = 1, 'certificates are a public registry';
end $$;

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
update public.emission_data set total_emissions = 1 where id = '10000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select total_emissions from public.emission_data where id = '10000000-0000-0000-0000-000000000001') = 1234.5,
    'certified inventories are immutable';
end $$;

-- SEMA ownership flows to child rows
insert into public.sema_clients (id, name) values ('20000000-0000-0000-0000-000000000001', 'Acme');
insert into public.sema_stakeholders (client_id, name, category) values ('20000000-0000-0000-0000-000000000001', 'Employees', 'Internal');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
do $$ begin
  begin
    insert into public.sema_stakeholders (client_id, name, category) values ('20000000-0000-0000-0000-000000000001', 'Intruder', 'External');
    raise exception 'wrote into another user''s SEMA client';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.sema_stakeholders) = 0, 'SEMA rows are private';
end $$;

-- Retirements accumulate on the certificate and flip its status once fully offset (1234.5 kg = 2 t)
reset role;
do $$ declare c public.certificates; begin
  select * into c from public.apply_retirement((select id from public.certificates where certificate_id = 'GT-TEST'), 1);
  assert c.offset_tonnes = 1 and c.status = 'partially_offset', 'partial offset';
  select * into c from public.apply_retirement(c.id, 1);
  assert c.offset_tonnes = 2 and c.status = 'offset', 'fully offset';
end $$;

-- Inventory reservation is atomic and never oversells
reset role;
insert into public.carbon_credits (id, slug, title, description, project_type, location, vintage, price_hbar, available, total_supply)
  values ('30000000-0000-0000-0000-000000000001', 'test', 't', 'd', 'Forest', 'X', '2025', 1, 5, 5);
do $$ begin
  assert public.reserve_credits('30000000-0000-0000-0000-000000000001', 3), 'reserve 3 of 5';
  assert not public.reserve_credits('30000000-0000-0000-0000-000000000001', 3), 'cannot reserve 3 of 2';
  perform public.release_credits('30000000-0000-0000-0000-000000000001', 3);
  assert (select available from public.carbon_credits where slug = 'test') = 5, 'release restores stock';
end $$;

-- The exchange scan's state is server-only: users can neither see nor move the cursor
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
do $$ begin
  assert (select count(*) from public.exchange_scan_state) = 0, 'scan state is hidden from users';
  update public.exchange_scan_state set cursor = '0.0';
end $$;
reset role;
do $$ begin
  assert (select cursor from public.exchange_scan_state where id = 1) <> '0.0', 'users cannot move the scan cursor';
end $$;

do $$ begin raise notice 'rls tests passed'; end $$;

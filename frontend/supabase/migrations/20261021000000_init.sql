-- GreenTrace schema.
-- Rule of thumb: users write their own working data (inventories, SEMA records) directly under RLS.
-- Anything that mirrors on-chain state or AI output (certificates, orders, retirements, audits,
-- extractions, ratings, plans) is written only by the server with the service role key, so a client
-- can never forge a transaction id, an audit result or a certificate.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  organization text,
  wallet_address text unique check (wallet_address is null or wallet_address = lower(wallet_address)),
  hedera_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their display fields only. Wallet linkage is set by the server after a signature check.
create or replace function public.guard_profile_wallet()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.wallet_address = old.wallet_address;
    new.hedera_account_id = old.hedera_account_id;
    new.email = old.email;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_wallet before update on public.profiles
  for each row execute function public.guard_profile_wallet();

-- ---------------------------------------------------------------------------
-- Emission inventories
-- ---------------------------------------------------------------------------

create table public.emission_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source text not null check (source in ('calculator', 'upload', 'ai_extraction')),
  file_name text,
  organization text,
  reporting_period_start date,
  reporting_period_end date,
  -- kg CO2e
  total_emissions numeric not null check (total_emissions >= 0),
  breakdown jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '[]'::jsonb,
  processed_data jsonb not null default '[]'::jsonb,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index emission_data_user_idx on public.emission_data (user_id, created_at desc);
create trigger emission_data_touch before update on public.emission_data
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- AI: source documents read by the extraction model
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  emission_data_id uuid references public.emission_data (id) on delete set null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  sha256 text not null,
  storage_path text,
  -- normalized supplier | invoice number | billing period, used to catch the same bill uploaded twice
  fingerprint text,
  status text not null check (status in ('extracted', 'failed')),
  extraction jsonb,
  model text,
  prompt_version text,
  extraction_hash text,
  hcs_tx_id text,
  hcs_sequence bigint,
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, sha256)
);

create index documents_user_idx on public.documents (user_id, created_at desc);
create index documents_fingerprint_idx on public.documents (user_id, fingerprint);

-- ---------------------------------------------------------------------------
-- AI: pre-mint audits
-- ---------------------------------------------------------------------------

create table public.ai_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  emission_data_id uuid not null references public.emission_data (id) on delete cascade,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  model text,
  ruleset_version text not null,
  audit_hash text not null,
  hcs_tx_id text,
  hcs_sequence bigint,
  created_at timestamptz not null default now()
);

create index ai_audits_emission_idx on public.ai_audits (emission_data_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Certificates (public registry: anyone can verify a certificate)
-- ---------------------------------------------------------------------------

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  emission_data_id uuid not null unique references public.emission_data (id) on delete restrict,
  audit_id uuid references public.ai_audits (id) on delete set null,
  certificate_id text not null unique,
  title text not null,
  organization text,
  -- kg CO2e
  total_emissions numeric not null,
  breakdown jsonb not null default '{}'::jsonb,
  status text not null default 'issued' check (status in ('issued', 'partially_offset', 'offset')),
  issue_date date not null default current_date,
  valid_until date not null default (current_date + interval '1 year'),
  data_hash text not null,
  metadata_cid text,
  metadata_pinned boolean not null default false,
  nft_token_id text,
  nft_serial bigint,
  nft_tx_id text,
  hcs_tx_id text,
  hcs_sequence bigint,
  -- tonnes CO2e retired against this certificate
  offset_tonnes integer not null default 0,
  created_at timestamptz not null default now()
);

create index certificates_user_idx on public.certificates (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------

create table public.carbon_credits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  project_type text not null,
  location text not null,
  vintage text not null,
  methodology text,
  registry text,
  registry_project_id text,
  -- price of one credit (1 tonne CO2e) in HBAR
  price_hbar numeric not null check (price_hbar > 0),
  available integer not null check (available >= 0),
  total_supply integer not null check (total_supply >= 0),
  image_url text,
  -- facts the AI quality rater reasons over (crediting period, buffer pool, monitoring, verifier...)
  project_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.credit_ratings (
  credit_id uuid primary key references public.carbon_credits (id) on delete cascade,
  grade text not null check (grade in ('AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'C')),
  overall_score integer not null check (overall_score between 0 and 100),
  scores jsonb not null,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  model text,
  rating_hash text not null,
  hcs_tx_id text,
  hcs_sequence bigint,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credit_id uuid not null references public.carbon_credits (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_hbar numeric not null,
  total_tinybar bigint not null check (total_tinybar > 0),
  -- bytes32 reference passed to the payment contract
  order_ref text not null unique,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'fulfilled', 'failed', 'expired')),
  buyer_evm_address text not null,
  buyer_account_id text,
  payment_tx_hash text unique,
  delivery_tx_id text,
  hcs_tx_id text,
  hcs_sequence bigint,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Reserve and release listing inventory atomically.
create or replace function public.reserve_credits(p_credit_id uuid, p_quantity integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.carbon_credits
       set available = available - p_quantity
     where id = p_credit_id and available >= p_quantity
    returning 1
  )
  select exists (select 1 from updated);
$$;

create or replace function public.release_credits(p_credit_id uuid, p_quantity integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.carbon_credits set available = available + p_quantity where id = p_credit_id;
$$;

revoke execute on function public.reserve_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_credits(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retirements (public registry)
-- ---------------------------------------------------------------------------

create table public.retirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  certificate_id uuid not null references public.certificates (id) on delete restrict,
  amount integer not null check (amount > 0),
  request_tx_hash text not null unique,
  retiree_evm_address text not null,
  retiree_account_id text,
  wipe_tx_id text,
  hcs_tx_id text,
  hcs_sequence bigint,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index retirements_certificate_idx on public.retirements (certificate_id, created_at desc);

-- Adds a completed retirement to its certificate and updates the offset status atomically.
create or replace function public.apply_retirement(p_certificate_id uuid, p_tonnes integer)
returns public.certificates
language sql
security definer
set search_path = public
as $$
  update public.certificates
     set offset_tonnes = offset_tonnes + p_tonnes,
         status = case when (offset_tonnes + p_tonnes) * 1000 >= total_emissions then 'offset' else 'partially_offset' end
   where id = p_certificate_id
  returning *;
$$;

revoke execute on function public.apply_retirement(uuid, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- AI: reduction plans and GRI drafts
-- ---------------------------------------------------------------------------

create table public.reduction_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  emission_data_id uuid not null references public.emission_data (id) on delete cascade,
  inputs jsonb not null,
  plan jsonb not null,
  model text,
  plan_hash text not null,
  hcs_tx_id text,
  hcs_sequence bigint,
  created_at timestamptz not null default now()
);

create index reduction_plans_emission_idx on public.reduction_plans (emission_data_id, created_at desc);

-- ---------------------------------------------------------------------------
-- SEMA (stakeholder engagement and materiality assessment)
-- ---------------------------------------------------------------------------

create table public.sema_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  industry text,
  size text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sema_clients_touch before update on public.sema_clients
  for each row execute function public.touch_updated_at();

create table public.sema_stakeholders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sema_clients (id) on delete cascade,
  name text not null,
  category text not null check (category in ('Internal', 'External')),
  stakeholder_type text,
  dependency_economic numeric not null default 0,
  dependency_social numeric not null default 0,
  dependency_environmental numeric not null default 0,
  influence_economic numeric not null default 0,
  influence_social numeric not null default 0,
  influence_environmental numeric not null default 0,
  total_score numeric not null default 0,
  normalized_score numeric not null default 0,
  influence_category text not null default 'Low' check (influence_category in ('High', 'Medium', 'Low')),
  is_priority boolean not null default false,
  population_size integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sema_stakeholders_touch before update on public.sema_stakeholders
  for each row execute function public.touch_updated_at();

create table public.sema_sample_parameters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.sema_clients (id) on delete cascade,
  confidence_level numeric not null,
  margin_error numeric not null,
  population_proportion numeric not null,
  z_score numeric,
  base_sample_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sema_sample_parameters_touch before update on public.sema_sample_parameters
  for each row execute function public.touch_updated_at();

create table public.sema_material_topics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sema_clients (id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('Economic', 'Environmental', 'Social')),
  gri_code text,
  average_score numeric not null default 0,
  response_count integer not null default 0,
  is_material boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sema_material_topics_touch before update on public.sema_material_topics
  for each row execute function public.touch_updated_at();

create table public.sema_internal_topics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sema_clients (id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('Economic', 'Environmental', 'Social')),
  severity numeric not null default 0,
  likelihood numeric not null default 0,
  significance numeric not null default 0,
  is_material boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sema_internal_topics_touch before update on public.sema_internal_topics
  for each row execute function public.touch_updated_at();

create table public.sema_questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.sema_material_topics (id) on delete cascade,
  stakeholder_type text not null,
  respondent_name text,
  score numeric not null,
  comments text,
  response_time integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.sema_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.sema_clients (id) on delete cascade,
  title text not null,
  report_type text not null check (report_type in ('materiality_assessment', 'stakeholder_engagement', 'full_sema')),
  material_topics jsonb not null default '[]'::jsonb,
  gri_disclosures jsonb not null default '{}'::jsonb,
  process_summary jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'final', 'published')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gri_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.sema_clients (id) on delete cascade,
  content jsonb not null,
  model text,
  draft_hash text not null,
  hcs_tx_id text,
  hcs_sequence bigint,
  created_at timestamptz not null default now()
);

create index gri_drafts_client_idx on public.gri_drafts (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Content-addressed store for metadata when no IPFS pinning service is configured.
-- Served read-only by the app at /api/ipfs/<cid>.
-- ---------------------------------------------------------------------------

create table public.ipfs_objects (
  cid text primary key,
  content jsonb not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI rate limiting
-- ---------------------------------------------------------------------------

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);

create index ai_requests_user_idx on public.ai_requests (user_id, feature, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.emission_data enable row level security;
alter table public.documents enable row level security;
alter table public.ai_audits enable row level security;
alter table public.certificates enable row level security;
alter table public.carbon_credits enable row level security;
alter table public.credit_ratings enable row level security;
alter table public.orders enable row level security;
alter table public.retirements enable row level security;
alter table public.reduction_plans enable row level security;
alter table public.sema_clients enable row level security;
alter table public.sema_stakeholders enable row level security;
alter table public.sema_sample_parameters enable row level security;
alter table public.sema_material_topics enable row level security;
alter table public.sema_internal_topics enable row level security;
alter table public.sema_questionnaire_responses enable row level security;
alter table public.sema_reports enable row level security;
alter table public.gri_drafts enable row level security;
alter table public.ipfs_objects enable row level security;
alter table public.ai_requests enable row level security;

-- Profiles
create policy "profiles: read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Emission inventories: full ownership, but an inventory that backs a certificate is immutable
create policy "emission_data: read own" on public.emission_data for select using (user_id = auth.uid());
create policy "emission_data: insert own" on public.emission_data for insert with check (user_id = auth.uid());
create policy "emission_data: update own unless certified" on public.emission_data for update
  using (user_id = auth.uid() and not exists (select 1 from public.certificates c where c.emission_data_id = emission_data.id))
  with check (user_id = auth.uid());
create policy "emission_data: delete own unless certified" on public.emission_data for delete
  using (user_id = auth.uid() and not exists (select 1 from public.certificates c where c.emission_data_id = emission_data.id));

-- Server-written records: owners can read
create policy "documents: read own" on public.documents for select using (user_id = auth.uid());
create policy "ai_audits: read own" on public.ai_audits for select using (user_id = auth.uid());
create policy "orders: read own" on public.orders for select using (user_id = auth.uid());
create policy "reduction_plans: read own" on public.reduction_plans for select using (user_id = auth.uid());
create policy "gri_drafts: read own" on public.gri_drafts for select using (user_id = auth.uid());

-- Public registry
create policy "certificates: public read" on public.certificates for select using (true);
create policy "retirements: public read" on public.retirements for select using (true);
create policy "carbon_credits: public read" on public.carbon_credits for select using (true);
create policy "credit_ratings: public read" on public.credit_ratings for select using (true);

-- SEMA: owner of the client owns every child row
create policy "sema_clients: own" on public.sema_clients for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.owns_sema_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sema_clients where id = p_client_id and user_id = auth.uid());
$$;

create policy "sema_stakeholders: own" on public.sema_stakeholders for all
  using (public.owns_sema_client(client_id)) with check (public.owns_sema_client(client_id));
create policy "sema_sample_parameters: own" on public.sema_sample_parameters for all
  using (public.owns_sema_client(client_id)) with check (public.owns_sema_client(client_id));
create policy "sema_material_topics: own" on public.sema_material_topics for all
  using (public.owns_sema_client(client_id)) with check (public.owns_sema_client(client_id));
create policy "sema_internal_topics: own" on public.sema_internal_topics for all
  using (public.owns_sema_client(client_id)) with check (public.owns_sema_client(client_id));
create policy "sema_reports: own" on public.sema_reports for all
  using (public.owns_sema_client(client_id)) with check (public.owns_sema_client(client_id));
create policy "sema_questionnaire_responses: own" on public.sema_questionnaire_responses for all
  using (exists (select 1 from public.sema_material_topics t where t.id = topic_id and public.owns_sema_client(t.client_id)))
  with check (exists (select 1 from public.sema_material_topics t where t.id = topic_id and public.owns_sema_client(t.client_id)));

-- ipfs_objects and ai_requests: no client policies (service role only)

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded source documents (path: <user_id>/<sha256>)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket: read own" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

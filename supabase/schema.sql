-- ============================================================
-- LogiMargin v7 — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        text not null default 'owner_op' check (role in ('owner_op','fleet_manager','driver')),
  company     text,
  mc_number   text,
  dot_number  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- ── Trips ─────────────────────────────────────────────────────
create table if not exists trips (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references profiles(id) on delete cascade,
  origin              text not null,
  destination         text not null,
  equipment_type      text not null default 'dry_van',
  status              text not null default 'quoted' check (status in ('quoted','booked','in_transit','delivered','invoiced','paid','cancelled')),
  gross_pay           numeric(10,2) not null,
  loaded_miles        integer not null,
  deadhead_miles      integer not null default 0,
  fuel_cost           numeric(10,2) not null default 0,
  toll_cost           numeric(10,2) not null default 0,
  driver_pay          numeric(10,2) not null default 0,
  maint_cost          numeric(10,2) not null default 0,
  factoring_rate      numeric(5,4),
  net_profit          numeric(10,2),
  net_margin_pct      numeric(5,4),
  logimargin_score    integer,
  verdict             text check (verdict in ('green','yellow','red')),
  action              text,
  pickup_date         date,
  delivery_date       date,
  broker_name         text,
  broker_rating       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Invoices ──────────────────────────────────────────────────
create table if not exists invoices (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references profiles(id) on delete cascade,
  trip_id           uuid references trips(id) on delete set null,
  invoice_number    text not null,
  invoice_amount    numeric(10,2) not null,
  advance_amount    numeric(10,2),
  status            text not null default 'pending' check (status in ('pending','submitted','approved','funded','rejected','disputed')),
  has_ai_errors     boolean not null default false,
  ai_error_amount   numeric(10,2),
  audit_result      jsonb,
  paid_at           timestamptz,
  payment_days      integer,
  created_at        timestamptz not null default now()
);

-- ── Brokers ───────────────────────────────────────────────────
create table if not exists brokers (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references profiles(id) on delete cascade,
  name              text not null,
  mc_number         text,
  risk_score        integer not null default 50 check (risk_score between 0 and 100),
  is_blacklisted    boolean not null default false,
  blacklist_reason  text,
  days_to_pay_avg   integer not null default 30,
  dispute_count     integer not null default 0,
  credit_rating     text,
  created_at        timestamptz not null default now()
);

-- ── Vehicle Maintenance ───────────────────────────────────────
create table if not exists vehicle_vitals (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid references profiles(id) on delete cascade,
  vehicle_name          text not null default 'Truck',
  current_odometer      integer not null,
  engine_hours          integer,
  last_oil_change_mi    integer,
  last_tire_rotate_mi   integer,
  last_injector_svc_mi  integer,
  last_def_fluid_mi     integer,
  baseline_cpm          numeric(6,4),
  recorded_at           timestamptz not null default now()
);

-- ── Detention Logs ────────────────────────────────────────────
create table if not exists detention_logs (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references profiles(id) on delete cascade,
  trip_id           uuid references trips(id) on delete set null,
  facility_name     text,
  entry_timestamp   timestamptz not null,
  exit_timestamp    timestamptz,
  rate_per_hour     numeric(8,2) not null default 50,
  billable_minutes  integer,
  billable_amount   numeric(10,2),
  claim_submitted   boolean not null default false,
  created_at        timestamptz not null default now()
);

-- Backward-compatible name used by the current app UI
create table if not exists detention_records (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references profiles(id) on delete cascade,
  facility_name      text,
  broker_name        text,
  entry_time         timestamptz,
  exit_time          timestamptz,
  detention_minutes  integer,
  billable_minutes   integer,
  billable_amount    numeric(10,2),
  rate_per_hour      numeric(8,2) not null default 50,
  created_at         timestamptz not null default now()
);

-- ── AI Load Drafts ────────────────────────────────────────────
create table if not exists load_drafts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles(id) on delete cascade,
  file_url      text not null,
  file_name     text not null,
  raw_ai_data   jsonb not null default '{}',
  status        text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confidence    numeric(4,3) not null default 0,
  has_warnings  boolean not null default false,
  warnings      text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists load_documents (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade,
  trip_id     uuid references trips(id) on delete set null,
  draft_id    uuid references load_drafts(id) on delete set null,
  doc_type    text not null default 'ratecon',
  file_url    text not null,
  file_name   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── IFTA Trip Legs ────────────────────────────────────────────
create table if not exists ifta_trip_legs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles(id) on delete cascade,
  trip_id       uuid references trips(id) on delete cascade,
  quarter       text not null,
  total_miles   integer not null,
  fuel_gallons  numeric(8,2) not null,
  state_miles   jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ── RLS policies ──────────────────────────────────────────────
alter table profiles       enable row level security;
alter table trips          enable row level security;
alter table invoices       enable row level security;
alter table brokers        enable row level security;
alter table vehicle_vitals enable row level security;
alter table detention_logs enable row level security;
alter table detention_records enable row level security;
alter table load_drafts enable row level security;
alter table load_documents enable row level security;
alter table ifta_trip_legs enable row level security;

drop policy if exists "Users own their profiles" on profiles;
drop policy if exists "Users own their trips" on trips;
drop policy if exists "Users own their invoices" on invoices;
drop policy if exists "Users own their brokers" on brokers;
drop policy if exists "Users own their vehicle vitals" on vehicle_vitals;
drop policy if exists "Users own their detention logs" on detention_logs;
drop policy if exists "Users own their detention records" on detention_records;
drop policy if exists "Users own their load drafts" on load_drafts;
drop policy if exists "Users own their load documents" on load_documents;
drop policy if exists "Users own their IFTA logs" on ifta_trip_legs;

create policy "Users own their profiles"       on profiles       for all using (auth.uid() = id);
create policy "Users own their trips"          on trips          for all using (auth.uid() = user_id);
create policy "Users own their invoices"       on invoices       for all using (auth.uid() = user_id);
create policy "Users own their brokers"        on brokers        for all using (auth.uid() = user_id);
create policy "Users own their vehicle vitals" on vehicle_vitals for all using (auth.uid() = user_id);
create policy "Users own their detention logs" on detention_logs for all using (auth.uid() = user_id);
create policy "Users own their detention records" on detention_records for all using (auth.uid() = user_id);
create policy "Users own their load drafts" on load_drafts for all using (auth.uid() = user_id);
create policy "Users own their load documents" on load_documents for all using (auth.uid() = user_id);
create policy "Users own their IFTA logs"      on ifta_trip_legs for all using (auth.uid() = user_id);

-- Broker score view expected by the API. RLS on base tables still limits rows
-- for anon/authenticated clients; service-role server calls can aggregate all rows.
create or replace view broker_scores as
select
  t.broker_name,
  count(*)::integer as total_loads,
  avg(t.gross_pay) as avg_gross_pay,
  avg(t.net_margin_pct) as avg_margin_pct,
  null::numeric as avg_payment_days,
  0::integer as dispute_count,
  0::integer as invoice_count,
  max(t.created_at) as last_load_at
from trips t
where t.broker_name is not null and t.broker_name <> ''
group by t.broker_name;

-- Storage bucket for uploaded RateCons/BOLs. Public read keeps generated URLs
-- usable by the review UI; uploads are still controlled by API/auth flow.
insert into storage.buckets (id, name, public)
values ('logistics_docs', 'logistics_docs', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload logistics docs" on storage.objects;
drop policy if exists "Public reads logistics docs" on storage.objects;

create policy "Authenticated users upload logistics docs"
  on storage.objects for insert
  with check (bucket_id = 'logistics_docs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public reads logistics docs"
  on storage.objects for select
  using (bucket_id = 'logistics_docs');

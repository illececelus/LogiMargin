-- ============================================================
-- LogiMargin v3 — Supabase Schema
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
  vehicle_name          text not null,
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
alter table ifta_trip_legs enable row level security;

create policy "Users own their profiles"       on profiles       for all using (auth.uid() = id);
create policy "Users own their trips"          on trips          for all using (auth.uid() = user_id);
create policy "Users own their invoices"       on invoices       for all using (auth.uid() = user_id);
create policy "Users own their brokers"        on brokers        for all using (auth.uid() = user_id);
create policy "Users own their vehicle vitals" on vehicle_vitals for all using (auth.uid() = user_id);
create policy "Users own their detention logs" on detention_logs for all using (auth.uid() = user_id);
create policy "Users own their IFTA logs"      on ifta_trip_legs for all using (auth.uid() = user_id);

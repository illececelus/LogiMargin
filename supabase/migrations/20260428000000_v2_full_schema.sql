-- ============================================================
-- LogiMargin v2 Full Schema - MVP Launch Foundation
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mc_number text,
  dot_number text,
  ein text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  logo_url text,
  plan text default 'starter' check (plan in ('starter','pro','fleet')),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'trialing',
  trial_ends_at timestamptz default now() + interval '14 days',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists organization_id uuid references organizations(id);
alter table profiles add column if not exists role text default 'driver' check (role in ('owner','admin','dispatcher','driver','accountant','owner_op','fleet_manager'));
alter table profiles add column if not exists company text;
alter table profiles add column if not exists mc_number text;
alter table profiles add column if not exists dot_number text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists onboarding_completed boolean default false;
alter table profiles add column if not exists notification_prefs jsonb default '{"email":true,"push":true,"sms":false}'::jsonb;

create table if not exists trucks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_number text not null,
  vin text,
  make text,
  model text,
  year integer,
  license_plate text,
  license_state text,
  status text default 'active' check (status in ('active','inactive','maintenance','sold')),
  current_mileage integer default 0,
  last_pm_mileage integer default 0,
  last_pm_date date,
  next_pm_mileage integer,
  next_pm_date date,
  insurance_expiry date,
  registration_expiry date,
  dot_inspection_expiry date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists trailers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_number text not null,
  type text check (type in ('dry_van','reefer','flatbed','step_deck','lowboy','tanker','other')),
  length_ft integer,
  vin text,
  license_plate text,
  license_state text,
  status text default 'active',
  registration_expiry date,
  created_at timestamptz default now()
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id),
  name text not null,
  email text,
  phone text,
  cdl_number text,
  cdl_state text,
  cdl_expiry date,
  medical_card_expiry date,
  hazmat_endorsement boolean default false,
  status text default 'active' check (status in ('active','inactive','terminated')),
  hired_at date,
  created_at timestamptz default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  origin text not null default 'Unknown',
  destination text not null default 'Unknown',
  equipment_type text not null default 'dry_van',
  status text not null default 'quoted' check (status in ('quoted','booked','in_transit','delivered','invoiced','paid','cancelled')),
  gross_pay numeric(10,2) not null default 0,
  loaded_miles numeric(8,2) not null default 0,
  deadhead_miles numeric(8,2) not null default 0,
  fuel_cost numeric(10,2) not null default 0,
  toll_cost numeric(10,2) not null default 0,
  driver_pay numeric(10,2) not null default 0,
  maint_cost numeric(10,2) not null default 0,
  factoring_rate numeric(5,4),
  net_profit numeric(10,2),
  net_margin_pct numeric(8,4),
  logimargin_score integer,
  verdict text check (verdict in ('green','yellow','red')),
  action text,
  pickup_date date,
  delivery_date date,
  broker_name text,
  broker_rating text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trips add column if not exists organization_id uuid references organizations(id);
alter table trips add column if not exists driver_id uuid references drivers(id);
alter table trips add column if not exists truck_id uuid references trucks(id);
alter table trips add column if not exists trailer_id uuid references trailers(id);
alter table trips add column if not exists origin_address text;
alter table trips add column if not exists origin_city text;
alter table trips add column if not exists origin_state text;
alter table trips add column if not exists destination_address text;
alter table trips add column if not exists destination_city text;
alter table trips add column if not exists destination_state text;
alter table trips add column if not exists pickup_appointment timestamptz;
alter table trips add column if not exists delivery_appointment timestamptz;
alter table trips add column if not exists actual_pickup timestamptz;
alter table trips add column if not exists actual_delivery timestamptz;
alter table trips add column if not exists commodity text;
alter table trips add column if not exists weight_lbs integer;
alter table trips add column if not exists fuel_surcharge numeric(10,2) default 0;
alter table trips add column if not exists lumper_cost numeric(10,2) default 0;
alter table trips add column if not exists bol_number text;
alter table trips add column if not exists pro_number text;
alter table trips add column if not exists reference_number text;
alter table trips add column if not exists notes text;

create table if not exists trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  stop_type text not null check (stop_type in ('pickup','delivery','fuel','rest','other')),
  sequence_order integer not null,
  facility_name text,
  address text,
  city text,
  state text,
  zip text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  appointment_time timestamptz,
  actual_arrival timestamptz,
  actual_departure timestamptz,
  detention_start timestamptz,
  detention_end timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  invoice_number text,
  invoice_amount numeric(10,2) not null default 0,
  advance_amount numeric(10,2),
  status text not null default 'draft' check (status in ('draft','pending','submitted','approved','factored','funded','paid','rejected','disputed','written_off')),
  has_ai_errors boolean not null default false,
  ai_error_amount numeric(10,2),
  audit_result jsonb,
  paid_at timestamptz,
  payment_days integer,
  created_at timestamptz not null default now()
);

alter table invoices add column if not exists organization_id uuid references organizations(id);
alter table invoices add column if not exists invoice_date date default current_date;
alter table invoices add column if not exists due_date date;
alter table invoices add column if not exists factoring_company text;
alter table invoices add column if not exists factoring_rate numeric(5,4);
alter table invoices add column if not exists factoring_fee numeric(10,2);
alter table invoices add column if not exists funded_date date;
alter table invoices add column if not exists paid_date date;
alter table invoices add column if not exists dispute_reason text;
alter table invoices add column if not exists updated_at timestamptz default now();

create table if not exists brokers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  mc_number text,
  risk_score integer not null default 50 check (risk_score between 0 and 100),
  is_blacklisted boolean not null default false,
  blacklist_reason text,
  days_to_pay_avg integer not null default 30,
  dispute_count integer not null default 0,
  credit_rating text,
  created_at timestamptz not null default now()
);

alter table brokers add column if not exists organization_id uuid references organizations(id);
alter table brokers add column if not exists dot_number text;
alter table brokers add column if not exists contact_name text;
alter table brokers add column if not exists contact_phone text;
alter table brokers add column if not exists contact_email text;
alter table brokers add column if not exists average_days_to_pay numeric(5,1);
alter table brokers add column if not exists is_factorable boolean default true;
alter table brokers add column if not exists fmcsa_verified boolean default false;
alter table brokers add column if not exists fmcsa_verified_at timestamptz;
alter table brokers add column if not exists credit_risk_score integer check (credit_risk_score between 0 and 100);
alter table brokers add column if not exists preferred_lanes text[];
alter table brokers add column if not exists updated_at timestamptz default now();

create table if not exists vehicle_vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  vehicle_name text not null default 'Truck',
  current_odometer integer not null,
  engine_hours integer,
  last_oil_change_mi integer,
  last_tire_rotate_mi integer,
  last_injector_svc_mi integer,
  last_def_fluid_mi integer,
  baseline_cpm numeric(6,4),
  recorded_at timestamptz not null default now()
);

create table if not exists maintenance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  truck_id uuid references trucks(id),
  trailer_id uuid references trailers(id),
  event_type text not null check (event_type in ('pm','oil_change','tire_rotation','brake_service','dot_inspection','repair','recall','other')),
  status text default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  scheduled_date date,
  completed_date date,
  mileage_at_service integer,
  vendor_name text,
  vendor_address text,
  cost numeric(10,2),
  description text,
  next_service_date date,
  next_service_mileage integer,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists detention_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  facility_name text,
  broker_name text,
  facility_address text,
  latitude double precision,
  longitude double precision,
  entry_time timestamptz,
  exit_time timestamptz,
  detention_minutes integer,
  billable_minutes integer,
  billable_amount numeric(10,2),
  rate_per_hour numeric(8,2) not null default 50,
  created_at timestamptz not null default now()
);

alter table detention_records add column if not exists organization_id uuid references organizations(id);
alter table detention_records add column if not exists trip_id uuid references trips(id);
alter table detention_records add column if not exists driver_id uuid references drivers(id);
alter table detention_records add column if not exists claim_status text default 'pending' check (claim_status in ('pending','submitted','disputed','paid','written_off'));
alter table detention_records add column if not exists claim_amount numeric(10,2);
alter table detention_records add column if not exists paid_amount numeric(10,2);
alter table detention_records add column if not exists bol_document_url text;
alter table detention_records add column if not exists claim_pdf_url text;
alter table detention_records add column if not exists email_sent_at timestamptz;
alter table detention_records add column if not exists updated_at timestamptz default now();

create table if not exists detention_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  facility_name text,
  entry_timestamp timestamptz not null,
  exit_timestamp timestamptz,
  rate_per_hour numeric(8,2) not null default 50,
  billable_minutes integer,
  billable_amount numeric(10,2),
  claim_submitted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists load_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  raw_ai_data jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confidence numeric(4,3) not null default 0,
  has_warnings boolean not null default false,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists load_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  draft_id uuid references load_drafts(id) on delete set null,
  doc_type text not null default 'ratecon',
  file_url text not null,
  file_name text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists ifta_trip_legs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  quarter text not null,
  total_miles integer not null,
  fuel_gallons numeric(8,2) not null,
  state_miles jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table ifta_trip_legs add column if not exists organization_id uuid references organizations(id);
alter table ifta_trip_legs add column if not exists truck_id uuid references trucks(id);
alter table ifta_trip_legs add column if not exists fuel_purchased_gallons numeric(8,3) default 0;
alter table ifta_trip_legs add column if not exists fuel_purchase_state text;
alter table ifta_trip_legs add column if not exists fuel_purchase_amount numeric(10,2);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  type text not null,
  title text not null,
  message text,
  data jsonb,
  is_read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  user_id uuid references profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  plan text not null check (plan in ('starter','pro','fleet')),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.get_user_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid()
$$;

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

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','profiles','trips','invoices','brokers','vehicle_vitals',
    'detention_logs','detention_records','load_drafts','load_documents',
    'ifta_trip_legs','trucks','trailers','drivers','trip_stops',
    'maintenance_events','notifications','audit_logs','subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  row record;
begin
  for row in
    select * from (values
      ('organizations', 'id = public.get_user_org_id()'),
      ('trucks', 'organization_id = public.get_user_org_id()'),
      ('trailers', 'organization_id = public.get_user_org_id()'),
      ('drivers', 'organization_id = public.get_user_org_id()'),
      ('maintenance_events', 'organization_id = public.get_user_org_id()'),
      ('notifications', 'organization_id = public.get_user_org_id()'),
      ('subscriptions', 'organization_id = public.get_user_org_id()'),
      ('audit_logs', 'organization_id = public.get_user_org_id()'),
      ('trips', 'user_id = auth.uid() or organization_id = public.get_user_org_id()'),
      ('invoices', 'user_id = auth.uid() or organization_id = public.get_user_org_id()'),
      ('brokers', 'user_id = auth.uid() or organization_id = public.get_user_org_id()'),
      ('vehicle_vitals', 'user_id = auth.uid()'),
      ('detention_logs', 'user_id = auth.uid()'),
      ('detention_records', 'user_id = auth.uid() or organization_id = public.get_user_org_id()'),
      ('load_drafts', 'user_id = auth.uid()'),
      ('load_documents', 'user_id = auth.uid()'),
      ('ifta_trip_legs', 'user_id = auth.uid() or organization_id = public.get_user_org_id()')
    ) as policies(table_name, using_expr)
  loop
    execute format('drop policy if exists org_isolation on public.%I', row.table_name);
    execute format('create policy org_isolation on public.%I for all using (%s) with check (%s)', row.table_name, row.using_expr, row.using_expr);
  end loop;
end $$;

create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_trips_org on trips(organization_id);
create index if not exists idx_trips_user_status on trips(user_id, status);
create index if not exists idx_trips_status on trips(status);
create index if not exists idx_invoices_org on invoices(organization_id);
create index if not exists idx_invoices_user_status on invoices(user_id, status);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_detention_org on detention_records(organization_id);
create index if not exists idx_detention_user_status on detention_records(user_id, claim_status);
create index if not exists idx_brokers_org on brokers(organization_id);
create index if not exists idx_trucks_org on trucks(organization_id);
create index if not exists idx_notifications_user on notifications(user_id, is_read);
create index if not exists idx_audit_org on audit_logs(organization_id, created_at desc);

drop trigger if exists set_updated_at_organizations on organizations;
create trigger set_updated_at_organizations before update on organizations for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at_trips on trips;
create trigger set_updated_at_trips before update on trips for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at_invoices on invoices;
create trigger set_updated_at_invoices before update on invoices for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at_brokers on brokers;
create trigger set_updated_at_brokers before update on brokers for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at_detention_records on detention_records;
create trigger set_updated_at_detention_records before update on detention_records for each row execute function public.update_updated_at();
drop trigger if exists set_updated_at_subscriptions on subscriptions;
create trigger set_updated_at_subscriptions before update on subscriptions for each row execute function public.update_updated_at();

create or replace view broker_scores as
select
  coalesce(b.name, t.broker_name) as broker_name,
  count(t.id)::integer as total_loads,
  avg(t.gross_pay) as avg_gross_pay,
  avg(t.net_margin_pct) as avg_margin_pct,
  null::numeric as avg_payment_days,
  0::integer as dispute_count,
  0::integer as invoice_count,
  max(t.created_at) as last_load_at
from trips t
left join brokers b on b.name = t.broker_name
where t.broker_name is not null and t.broker_name <> ''
group by coalesce(b.name, t.broker_name);

insert into storage.buckets (id, name, public)
values ('logistics_docs', 'logistics_docs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('logistics-docs', 'logistics-docs', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users upload logistics docs" on storage.objects;
drop policy if exists "Public reads logistics docs" on storage.objects;
drop policy if exists "Authenticated logistics-docs access" on storage.objects;

create policy "Authenticated users upload logistics docs"
  on storage.objects for insert
  with check (bucket_id = 'logistics_docs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public reads logistics docs"
  on storage.objects for select
  using (bucket_id = 'logistics_docs');

create policy "Authenticated logistics-docs access"
  on storage.objects for all
  using (bucket_id = 'logistics-docs' and auth.role() = 'authenticated')
  with check (bucket_id = 'logistics-docs' and auth.role() = 'authenticated');

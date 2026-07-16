-- ============================================================
-- DIGICK Devis — Schéma initial
-- Toutes les tables : UUID, soft delete (deleted_at),
-- created_at / updated_at, Row Level Security.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Trigger générique updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- profiles — 1 ligne par utilisateur auth
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  full_name text,
  language text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- companies — 1 entreprise par utilisateur
-- ------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  owner_name text,
  phone text,
  whatsapp text,
  address text,
  email text,
  logo_url text,
  color text not null default '#131F35',
  -- Informations légales OHADA (optionnelles)
  rccm text,
  nif text,
  tax_regime text not null default 'reel'
    check (tax_regime in ('reel', 'synthetique', 'franchise')),
  vat_enabled boolean not null default false,
  vat_rate numeric(5, 2) not null default 18
    check (vat_rate >= 0 and vat_rate <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index companies_one_per_owner
  on public.companies (owner_id) where deleted_at is null;

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- clients
-- ------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clients_company_idx on public.clients (company_id) where deleted_at is null;

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- catalog_items — deux types : produit / prestation
-- ------------------------------------------------------------
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  type text not null default 'prestation'
    check (type in ('produit', 'prestation')),
  unit text not null default 'unité',
  unit_price integer not null check (unit_price >= 0),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index catalog_items_company_idx on public.catalog_items (company_id) where deleted_at is null;

create trigger catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- documents — devis et factures
-- ------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  type text not null check (type in ('devis', 'facture')),
  number text not null,
  status text not null default 'brouillon'
    check (status in ('brouillon', 'envoye', 'accepte', 'refuse', 'paye')),
  title text not null default '',
  issue_date date not null default current_date,
  -- Instantané client (le document reste intact si le client change)
  client_name text not null default '',
  client_phone text not null default '',
  -- Totaux calculés à l'écriture (moteur de calcul côté lib partagée)
  subtotal integer not null default 0 check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  vat_enabled boolean not null default false,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount integer not null default 0,
  total integer not null default 0,
  note text not null default '',
  conditions text not null default '',
  converted_from uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index documents_number_unique on public.documents (company_id, number);
create index documents_company_idx on public.documents (company_id, created_at desc) where deleted_at is null;

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- document_items — lignes d'un document
-- ------------------------------------------------------------
create table public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  unit text not null default 'unité',
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price integer not null default 0 check (unit_price >= 0),
  line_total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index document_items_document_idx on public.document_items (document_id);

create trigger document_items_updated_at
  before update on public.document_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- plans — configuration des offres (jamais codée en dur)
-- monthly_quota : null = illimité, 0 = paiement à l'usage
-- ------------------------------------------------------------
create table public.plans (
  key text primary key,
  name text not null,
  price_fcfa integer not null default 0,
  monthly_quota integer,
  per_document_price_fcfa integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (key, name, price_fcfa, monthly_quota, per_document_price_fcfa, sort_order) values
  ('express',  'DIGICK Express',  0,    0,    500,  1),
  ('pro',      'DIGICK Pro',      3000, 25,   null, 2),
  ('business', 'DIGICK Business', 5000, null, null, 3);

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plan_key text not null references public.plans (key),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '1 month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index subscriptions_one_active_per_company
  on public.subscriptions (company_id) where deleted_at is null and status = 'active';

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  amount integer not null check (amount >= 0),
  currency text not null default 'XAF',
  provider text not null default 'simulated',
  method text not null default 'orange_money'
    check (method in ('orange_money', 'mtn_momo', 'card')),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  reference text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index payments_company_idx on public.payments (company_id, created_at desc);

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- activity_logs
-- ------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null default '',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_company_idx on public.activity_logs (company_id, created_at desc);

-- ------------------------------------------------------------
-- document_counters — numérotation atomique par entreprise
-- (les numéros ne sont jamais réutilisés, même après suppression)
-- ------------------------------------------------------------
create table public.document_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  doc_type text not null check (doc_type in ('devis', 'facture')),
  counter integer not null default 0,
  primary key (company_id, doc_type)
);

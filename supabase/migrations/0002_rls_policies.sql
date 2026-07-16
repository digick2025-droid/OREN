-- ============================================================
-- DIGICK Devis — Row Level Security
-- Chaque utilisateur ne voit que les données de son entreprise.
-- Pas de politique DELETE : la suppression passe par deleted_at.
-- ============================================================

-- Entreprise(s) de l'utilisateur courant (stable → plan-cache friendly)
create or replace function public.user_company_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.companies
  where owner_id = auth.uid() and deleted_at is null;
$$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
alter table public.companies enable row level security;

create policy "companies_select_own" on public.companies
  for select using (owner_id = auth.uid());
create policy "companies_insert_own" on public.companies
  for insert with check (owner_id = auth.uid());
create policy "companies_update_own" on public.companies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------
-- clients
-- ------------------------------------------------------------
alter table public.clients enable row level security;

create policy "clients_select_own" on public.clients
  for select using (company_id in (select public.user_company_ids()));
create policy "clients_insert_own" on public.clients
  for insert with check (company_id in (select public.user_company_ids()));
create policy "clients_update_own" on public.clients
  for update using (company_id in (select public.user_company_ids()))
  with check (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- catalog_items
-- ------------------------------------------------------------
alter table public.catalog_items enable row level security;

create policy "catalog_select_own" on public.catalog_items
  for select using (company_id in (select public.user_company_ids()));
create policy "catalog_insert_own" on public.catalog_items
  for insert with check (company_id in (select public.user_company_ids()));
create policy "catalog_update_own" on public.catalog_items
  for update using (company_id in (select public.user_company_ids()))
  with check (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- documents
-- ------------------------------------------------------------
alter table public.documents enable row level security;

create policy "documents_select_own" on public.documents
  for select using (company_id in (select public.user_company_ids()));
create policy "documents_insert_own" on public.documents
  for insert with check (company_id in (select public.user_company_ids()));
create policy "documents_update_own" on public.documents
  for update using (company_id in (select public.user_company_ids()))
  with check (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- document_items
-- ------------------------------------------------------------
alter table public.document_items enable row level security;

create policy "document_items_select_own" on public.document_items
  for select using (document_id in (
    select id from public.documents
    where company_id in (select public.user_company_ids())
  ));
create policy "document_items_insert_own" on public.document_items
  for insert with check (document_id in (
    select id from public.documents
    where company_id in (select public.user_company_ids())
  ));
create policy "document_items_update_own" on public.document_items
  for update using (document_id in (
    select id from public.documents
    where company_id in (select public.user_company_ids())
  ));

-- ------------------------------------------------------------
-- plans — lecture publique (les prix s'affichent avant connexion)
-- ------------------------------------------------------------
alter table public.plans enable row level security;

create policy "plans_select_all" on public.plans
  for select using (is_active = true);

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- payments — lecture + insertion pour sa propre entreprise
-- (statut modifiable uniquement côté serveur)
-- ------------------------------------------------------------
alter table public.payments enable row level security;

create policy "payments_select_own" on public.payments
  for select using (company_id in (select public.user_company_ids()));
create policy "payments_insert_own" on public.payments
  for insert with check (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- activity_logs — lecture seule ; écrit par les fonctions RPC
-- ------------------------------------------------------------
alter table public.activity_logs enable row level security;

create policy "activity_logs_select_own" on public.activity_logs
  for select using (company_id in (select public.user_company_ids()));

-- ------------------------------------------------------------
-- document_counters — aucun accès direct (géré par RPC)
-- ------------------------------------------------------------
alter table public.document_counters enable row level security;

-- ------------------------------------------------------------
-- Storage : bucket logos (lecture publique, écriture par dossier
-- = id de l'entreprise du propriétaire)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');
create policy "logos_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.companies where owner_id = auth.uid()
    )
  );
create policy "logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.companies where owner_id = auth.uid()
    )
  );
create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.companies where owner_id = auth.uid()
    )
  );

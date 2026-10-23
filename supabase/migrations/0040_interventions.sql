-- ============================================================
-- 0040 : OREN ENTREPRISE — Phase 2 (cœur FSM : interventions)
--
-- L'objet central du module terrain : une intervention (bon de
-- travail) rattachée à l'entreprise, optionnellement à un client,
-- affectée à un membre (technicien), avec un statut de cycle de vie.
--
-- Accès par appartenance (comme clients/catalog) via user_company_ids()
-- (0037) : tout membre actif de l'entreprise. Le cloisonnement fin
-- « le technicien ne voit que SES interventions » est volontairement
-- reporté (il viendra avec l'app technicien).
-- ============================================================

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'a_planifier'
    check (status in ('a_planifier', 'planifiee', 'en_cours', 'terminee', 'annulee')),
  -- Membre affecté (technicien). Référence auth.users comme company_members.user_id.
  assigned_to uuid references auth.users (id) on delete set null,
  scheduled_at timestamptz,
  address text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index interventions_company_idx
  on public.interventions (company_id, created_at desc) where deleted_at is null;
create index interventions_assigned_idx
  on public.interventions (assigned_to) where deleted_at is null;
create index interventions_client_idx
  on public.interventions (client_id) where deleted_at is null;

create trigger interventions_updated_at
  before update on public.interventions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — accès par appartenance (tous les membres actifs). Pas de
-- policy DELETE : suppression par deleted_at, comme le reste.
-- ------------------------------------------------------------
alter table public.interventions enable row level security;

create policy "interventions_select_own" on public.interventions
  for select using (company_id in (select public.user_company_ids()));
create policy "interventions_insert_own" on public.interventions
  for insert with check (company_id in (select public.user_company_ids()));
create policy "interventions_update_own" on public.interventions
  for update using (company_id in (select public.user_company_ids()))
  with check (company_id in (select public.user_company_ids()));

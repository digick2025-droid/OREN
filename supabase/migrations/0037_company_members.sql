-- ============================================================
-- 0037 : OREN ENTREPRISE — Phase 1 (fondation multi-utilisateurs)
--
-- Introduit les comptes rattachés à une entreprise avec des rôles
-- (company_members) et le rattachement par téléphone
-- (company_invitations), SANS casser le cas mono-propriétaire
-- actuel ni activer l'offre.
--
-- Clé de la non-régression : chaque propriétaire existant est
-- rétro-rempli comme membre « gerant » de sa propre entreprise, si
-- bien que la réécriture de user_company_ids() (propriétaire ∪
-- membre actif) renvoie exactement le même ensemble qu'avant pour
-- les comptes actuels. Toute la RLS héritée (0002) qui utilise
-- « company_id in (select public.user_company_ids()) » continue
-- donc de fonctionner à l'identique.
--
-- Les RPC qui vérifient encore owner_id = auth.uid() en dur
-- (get_usage, create_document, convert_document_to_invoice,
-- change_plan) + les RPC de gestion d'équipe sont dans 0038.
-- ============================================================

-- ------------------------------------------------------------
-- company_members — comptes rattachés à une entreprise + rôle.
-- companies.owner_id reste le propriétaire/contact facturation ;
-- l'index companies_one_per_owner est conservé (un membre REJOINT
-- une entreprise, il n'en crée pas).
-- ------------------------------------------------------------
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null
    check (role in ('gerant', 'dispatcheur', 'commercial', 'technicien', 'comptable')),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index company_members_unique
  on public.company_members (company_id, user_id) where deleted_at is null;
create index company_members_user_idx
  on public.company_members (user_id) where deleted_at is null;

create trigger company_members_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- Backfill : chaque propriétaire devient membre « gerant » actif de
-- sa propre entreprise (source de la non-régression).
insert into public.company_members (company_id, user_id, role, status)
select id, owner_id, 'gerant', 'active'
from public.companies
where deleted_at is null
on conflict do nothing;

-- Toute NOUVELLE entreprise rattache aussi son propriétaire comme membre
-- « gerant » (le backfill ci-dessus ne couvre que l'existant). On étend
-- handle_new_company (0003), qui crée déjà l'abonnement gratuit.
create or replace function public.handle_new_company()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (company_id, plan_key)
  values (new.id, 'free');
  insert into public.company_members (company_id, user_id, role, status)
  values (new.id, new.owner_id, 'gerant', 'active')
  on conflict do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- company_invitations — rattachement par téléphone, cohérent avec
-- l'auth OTP. Écrites/lues via les RPC SECURITY DEFINER (0038) ;
-- seule une policy SELECT est posée ici.
-- ------------------------------------------------------------
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  phone text not null,                 -- normalisé E.164 côté RPC/app
  role text not null
    check (role in ('dispatcheur', 'commercial', 'technicien', 'comptable')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_invitations_phone_idx
  on public.company_invitations (phone) where status = 'pending';
create index company_invitations_company_idx
  on public.company_invitations (company_id);

create trigger company_invitations_updated_at
  before update on public.company_invitations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- user_company_ids() — réécriture ADDITIVE : entreprises possédées
-- ∪ entreprises où l'utilisateur est membre actif. Propage à toute
-- la RLS existante (0002) sans la modifier.
-- ------------------------------------------------------------
create or replace function public.user_company_ids()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.companies
    where owner_id = auth.uid() and deleted_at is null
  union
  select company_id from public.company_members
    where user_id = auth.uid() and status = 'active' and deleted_at is null;
$$;

-- ------------------------------------------------------------
-- has_company_role() — le propriétaire compte toujours comme gérant.
-- Réutilisable dans les RLS et les RPC (comme is_admin()).
-- ------------------------------------------------------------
create or replace function public.has_company_role(p_company_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.companies
    where id = p_company_id and owner_id = auth.uid() and deleted_at is null
  ) or exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid()
      and status = 'active' and deleted_at is null and role = any (p_roles)
  );
$$;

-- ------------------------------------------------------------
-- RLS — company_members
-- Lecture : tous les membres de l'entreprise. Écriture : gérant
-- uniquement (la gestion passe surtout par les RPC de 0038, mais on
-- verrouille la table).
-- ------------------------------------------------------------
alter table public.company_members enable row level security;

create policy "company_members_select" on public.company_members
  for select using (company_id in (select public.user_company_ids()));
create policy "company_members_insert_gerant" on public.company_members
  for insert with check (public.has_company_role(company_id, array['gerant']));
create policy "company_members_update_gerant" on public.company_members
  for update using (public.has_company_role(company_id, array['gerant']))
  with check (public.has_company_role(company_id, array['gerant']));

-- ------------------------------------------------------------
-- RLS — company_invitations
-- Lecture : membres de l'entreprise, OU l'invité lui-même (par son
-- téléphone de profil, pour voir « mes invitations »). Les écritures
-- passent exclusivement par les RPC SECURITY DEFINER (0038).
-- ------------------------------------------------------------
alter table public.company_invitations enable row level security;

create policy "company_invitations_select" on public.company_invitations
  for select using (
    company_id in (select public.user_company_ids())
    or phone = (select phone from public.profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- companies — rendre l'entreprise visible à ses membres (ADDITIF).
-- On conserve companies_select_own / _insert_own / _update_own
-- (0002, basées sur owner_id). L'édition du profil entreprise et le
-- storage « logos » restent propriétaire/gérant en phase 1.
-- ------------------------------------------------------------
create policy "companies_select_member" on public.companies
  for select using (id in (select public.user_company_ids()));

-- ============================================================
-- 0031 : relances push — abonnements des appareils, journal des envois,
-- et trace de la dernière visite (le signal d'inactivité n'existait pas).
-- ============================================================

-- ------------------------------------------------------------
-- Dernière visite
-- ------------------------------------------------------------
-- auth.users.last_sign_in_at ne convient pas : la session Supabase se
-- renouvelle toute seule pendant des semaines, un utilisateur peut ouvrir
-- l'application tous les jours sans jamais se reconnecter. On trace donc
-- l'ouverture réelle, pas l'authentification.
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Renseigne la colonne pour l'existant, sinon toute la base parait inactive
-- au premier passage du cron et recevrait une relance le meme jour.
update public.profiles set last_seen_at = greatest(created_at, updated_at)
  where last_seen_at is null;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at);

-- Appelée par l'application à l'ouverture. `security definer` : l'utilisateur
-- n'a le droit d'écrire que cette colonne, et uniquement sur sa propre ligne.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- ------------------------------------------------------------
-- Abonnements push (un par appareil / navigateur)
-- ------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Identifiant de l'appareil chez le service de push du navigateur. Unique :
  -- un même appareil réabonné ne doit pas recevoir la notification deux fois.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Langue figée à l'abonnement : l'envoi est fait par le serveur, hors de
  -- toute requête utilisateur, il n'a aucun cookie de langue sous la main.
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  -- Un abonnement expiré répond 404/410 : on le supprime plutôt que de
  -- réessayer indéfiniment (voir la route /api/cron/relances).
  failure_count integer not null default 0
);

create index push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun gère les abonnements de ses propres appareils. Le cron passe par la
-- clé de service et n'est donc pas soumis à ces politiques.
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

-- Compte un échec d'envoi, et abandonne l'abonnement au bout de 5 jours
-- d'affilée. Un service de push peut être indisponible ponctuellement : on ne
-- supprime pas un appareil sur un seul incident réseau, mais on ne réessaie
-- pas non plus indéfiniment. Réservée au serveur (clé de service).
create or replace function public.bump_push_failure(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_subscriptions
    set failure_count = failure_count + 1
    where id = p_subscription_id;

  delete from public.push_subscriptions
    where id = p_subscription_id and failure_count >= 5;
end;
$$;

revoke all on function public.bump_push_failure(uuid) from public;

-- ------------------------------------------------------------
-- Journal des relances envoyées
-- ------------------------------------------------------------
-- Sert de garde-fou : sans lui, le cron quotidien renverrait chaque jour la
-- même relance au même utilisateur — le plus sûr moyen de faire désactiver
-- les notifications, définitivement et pour toute l'application.
create table public.relance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in (
      'inactivite',
      'devis_en_attente',
      'facture_impayee',
      'compte_inacheve'
    )
  ),
  -- Document concerné pour les relances qui en visent un ; null sinon.
  document_id uuid references public.documents (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index relance_logs_user_sent_idx
  on public.relance_logs (user_id, sent_at desc);

create index relance_logs_document_idx
  on public.relance_logs (document_id) where document_id is not null;

alter table public.relance_logs enable row level security;

-- Lecture seule pour l'intéressé (utile pour un futur écran « historique »).
-- L'écriture est réservée à la clé de service, donc au cron.
create policy "relance_logs_select_own" on public.relance_logs
  for select using ((select auth.uid()) = user_id);

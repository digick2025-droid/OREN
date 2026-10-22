-- ============================================================
-- 0038 : suivi du parcours (funnel) — du premier clic au devis envoyé.
--
-- But : savoir où les visiteurs décrochent et combien de temps prend
-- réellement le premier document, pour vérifier la promesse « 2 minutes ».
--
-- Choix :
--  - Interne, sans outil tiers : les événements restent dans la base.
--  - Aucune donnée personnelle : un identifiant d'appareil aléatoire
--    (anon_id, tiré côté navigateur), le compte si connecté, et quelques
--    propriétés techniques (type de document, durée). Jamais de nom,
--    email, téléphone ou montant.
--  - Écriture uniquement via track_event (security definer) : liste
--    blanche d'événements, taille des propriétés bornée. La table n'est
--    lisible que par les admins, via admin_funnel_stats.
-- ============================================================

create table if not exists public.funnel_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event text not null,
  anon_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  props jsonb not null default '{}'::jsonb
);

create index if not exists funnel_events_created_at_idx
  on public.funnel_events (created_at);
create index if not exists funnel_events_anon_event_idx
  on public.funnel_events (anon_id, event, created_at);
create index if not exists funnel_events_user_id_idx
  on public.funnel_events (user_id);

-- RLS sans aucune policy : ni lecture ni écriture directe. Tout passe par
-- les deux fonctions ci-dessous.
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from anon, authenticated;

-- ------------------------------------------------------------
-- track_event : enregistre un événement du parcours.
-- Appelable sans session (landing, inscription, Express).
-- ------------------------------------------------------------
create or replace function public.track_event(
  p_event text,
  p_anon_id uuid,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer set search_path = public
as $$
begin
  -- Liste blanche : un nom inconnu est ignoré sans erreur, pour qu'un
  -- client plus récent que la base ne casse jamais l'application.
  if p_event not in (
    'landing_view',
    'signup_view',
    'signup_completed',
    'builder_opened',
    'quota_blocked',
    'document_generated',
    'document_shared',
    'express_started',
    'express_preview',
    'express_done',
    'express_to_signup'
  ) then
    return;
  end if;

  if p_anon_id is null then
    return;
  end if;

  if p_props is null or jsonb_typeof(p_props) <> 'object'
     or pg_column_size(p_props) > 2048 then
    p_props := '{}'::jsonb;
  end if;

  insert into public.funnel_events (event, anon_id, user_id, props)
  values (p_event, p_anon_id, auth.uid(), p_props);
end;
$$;

revoke execute on function public.track_event(text, uuid, jsonb) from public;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- admin_funnel_stats : entonnoir et temps du premier document.
--
-- Unité : l'appareil (anon_id). Un même appareil garde son identifiant
-- avant et après l'inscription, ce qui relie la landing au premier envoi.
-- Une étape compte un appareil s'il l'a franchie au moins une fois dans
-- la période.
-- ------------------------------------------------------------
create or replace function public.admin_funnel_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_since timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  v_since := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));

  with ev as (
    select * from public.funnel_events where created_at >= v_since
  ),
  steps as (
    select event, count(distinct anon_id) as devices
    from ev
    group by event
  ),
  -- Parcours compte : de l'arrivée sur l'inscription au premier envoi.
  firsts as (
    select
      anon_id,
      min(created_at) filter (where event = 'signup_view') as signup_at,
      min(created_at) filter (where event = 'signup_completed') as signed_up_at,
      min(created_at) filter (where event = 'document_shared') as shared_at
    from ev
    group by anon_id
  ),
  journeys as (
    select extract(epoch from (shared_at - signup_at)) as seconds
    from firsts
    where signup_at is not null and shared_at is not null and shared_at > signup_at
  ),
  -- Temps de saisie : ouverture du formulaire → génération (mesuré côté
  -- navigateur et transmis dans props.duration_ms).
  builds as (
    select (props->>'duration_ms')::numeric / 1000 as seconds
    from ev
    where event = 'document_generated'
      and props ? 'duration_ms'
      and jsonb_typeof(props->'duration_ms') = 'number'
  )
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'steps', coalesce((select jsonb_object_agg(event, devices) from steps), '{}'::jsonb),
    'signup_to_first_share', jsonb_build_object(
      'count', (select count(*) from journeys),
      'median_seconds', (select percentile_cont(0.5) within group (order by seconds) from journeys),
      'under_2_min', (select count(*) from journeys where seconds <= 120)
    ),
    'build_time', jsonb_build_object(
      'count', (select count(*) from builds),
      'median_seconds', (select percentile_cont(0.5) within group (order by seconds) from builds),
      'under_2_min', (select count(*) from builds where seconds <= 120)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_funnel_stats(integer) from anon, public;
grant execute on function public.admin_funnel_stats(integer) to authenticated;

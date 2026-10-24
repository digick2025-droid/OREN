-- ============================================================
-- 0047 : OREN ENTREPRISE — numérotation OT- / RI-
--
-- Chaque intervention reçoit un numéro OT-NNN (ordre/bon de travail)
-- et chaque rapport un numéro RI-NNN (rapport d'intervention), par
-- entreprise, monotone et jamais réutilisé. On réutilise le compteur
-- atomique `document_counters` (0001/0003) — même garantie que
-- DEV-/FAC-/PRO-. L'INSERT étant direct (pas de RPC comme documents),
-- le numéro est posé par un trigger BEFORE INSERT.
-- ============================================================

-- Étend le jeu de doc_type autorisés dans le compteur partagé.
alter table public.document_counters
  drop constraint if exists document_counters_doc_type_check;
alter table public.document_counters
  add constraint document_counters_doc_type_check
  check (doc_type in ('devis', 'facture', 'proforma', 'intervention', 'rapport'));

alter table public.interventions add column if not exists number text;
alter table public.intervention_reports add column if not exists number text;

-- ------------------------------------------------------------
-- Compteurs : OT- (interventions) et RI- (rapports).
-- security definer : écrit document_counters quel que soit l'appelant,
-- mais appelées uniquement par les triggers ci-dessous (revoke direct).
-- ------------------------------------------------------------
create or replace function public.next_intervention_number(p_company_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_counter integer;
begin
  insert into public.document_counters (company_id, doc_type, counter)
  values (p_company_id, 'intervention', 1)
  on conflict (company_id, doc_type)
  do update set counter = public.document_counters.counter + 1
  returning counter into v_counter;
  return 'OT-' || lpad(v_counter::text, 3, '0');
end;
$$;

create or replace function public.next_report_number(p_company_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_counter integer;
begin
  insert into public.document_counters (company_id, doc_type, counter)
  values (p_company_id, 'rapport', 1)
  on conflict (company_id, doc_type)
  do update set counter = public.document_counters.counter + 1
  returning counter into v_counter;
  return 'RI-' || lpad(v_counter::text, 3, '0');
end;
$$;

revoke all on function public.next_intervention_number(uuid) from public, anon, authenticated;
revoke all on function public.next_report_number(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Backfill : numérote l'existant par entreprise, dans l'ordre de
-- création (y compris les lignes supprimées, pour ne jamais réutiliser
-- un numéro), puis cale le compteur sur le nombre de lignes numérotées.
-- ------------------------------------------------------------
with ranked as (
  select id, company_id,
         row_number() over (partition by company_id order by created_at, id) as rn
  from public.interventions
  where number is null
)
update public.interventions i
set number = 'OT-' || lpad(ranked.rn::text, 3, '0')
from ranked
where ranked.id = i.id;

insert into public.document_counters (company_id, doc_type, counter)
select company_id, 'intervention', count(*)
from public.interventions
where number is not null
group by company_id
on conflict (company_id, doc_type)
do update set counter = greatest(public.document_counters.counter, excluded.counter);

with ranked as (
  select id, company_id,
         row_number() over (partition by company_id order by created_at, id) as rn
  from public.intervention_reports
  where number is null
)
update public.intervention_reports r
set number = 'RI-' || lpad(ranked.rn::text, 3, '0')
from ranked
where ranked.id = r.id;

insert into public.document_counters (company_id, doc_type, counter)
select company_id, 'rapport', count(*)
from public.intervention_reports
where number is not null
group by company_id
on conflict (company_id, doc_type)
do update set counter = greatest(public.document_counters.counter, excluded.counter);

-- ------------------------------------------------------------
-- Triggers : pose le numéro à la création si absent.
-- ------------------------------------------------------------
create or replace function public.set_intervention_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.number is null then
    new.number := public.next_intervention_number(new.company_id);
  end if;
  return new;
end;
$$;

create or replace function public.set_report_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.number is null then
    new.number := public.next_report_number(new.company_id);
  end if;
  return new;
end;
$$;

drop trigger if exists interventions_set_number on public.interventions;
create trigger interventions_set_number
  before insert on public.interventions
  for each row execute function public.set_intervention_number();

drop trigger if exists intervention_reports_set_number on public.intervention_reports;
create trigger intervention_reports_set_number
  before insert on public.intervention_reports
  for each row execute function public.set_report_number();

-- Unicité du numéro par entreprise.
create unique index if not exists interventions_number_uniq
  on public.interventions (company_id, number) where number is not null;
create unique index if not exists intervention_reports_number_uniq
  on public.intervention_reports (company_id, number) where number is not null;

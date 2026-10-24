-- ============================================================
-- 0046 : OREN ENTREPRISE — rapport d'intervention signé (phase 3)
--
-- Le livrable terrain du technicien : pour une intervention, un
-- compte-rendu avec photos AVANT/APRÈS et signature du client. Un
-- rapport par intervention (contrainte unique).
--
-- Accès : même cloisonnement que l'intervention porteuse (0045) — les
-- rôles bureau voient tout, le technicien seulement les siennes. On ne
-- peut pas déléguer à la RLS d'`interventions` (pas de cascade de
-- policy à travers une jointure), donc on re-teste l'appartenance +
-- le rôle ici via un EXISTS sur l'intervention.
-- ============================================================

-- ------------------------------------------------------------
-- Bucket privé pour les photos et signatures. Dossier racine =
-- company_id (comme « documents », 0015) : relecture par URL signée.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('intervention-photos', 'intervention-photos', false)
on conflict (id) do nothing;

drop policy if exists "iv_photos_read" on storage.objects;
drop policy if exists "iv_photos_write" on storage.objects;
drop policy if exists "iv_photos_update" on storage.objects;
drop policy if exists "iv_photos_delete" on storage.objects;

create policy "iv_photos_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intervention-photos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "iv_photos_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'intervention-photos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "iv_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'intervention-photos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

create policy "iv_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'intervention-photos'
    and (storage.foldername(name))[1] in (
      select cid::text from public.user_company_ids() as cid
    )
  );

-- ------------------------------------------------------------
-- Table rapport. photos = jsonb [{ "path": "...", "kind": "before"|"after" }].
-- La signature est une image dans le bucket (signature_path), le nom
-- du signataire et l'horodatage matérialisent « signé ».
-- ------------------------------------------------------------
create table public.intervention_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  intervention_id uuid not null unique
    references public.interventions (id) on delete cascade,
  summary text not null default '',
  photos jsonb not null default '[]'::jsonb,
  signature_path text,
  signed_by text not null default '',
  signed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intervention_reports_company_idx
  on public.intervention_reports (company_id);

create trigger intervention_reports_updated_at
  before update on public.intervention_reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — « peut accéder au rapport » = « peut accéder à l'intervention »
-- (rôle bureau OU technicien affecté). Même prédicat en select/insert/
-- update. Pas de delete (le rapport suit l'intervention).
-- ------------------------------------------------------------
alter table public.intervention_reports enable row level security;

create policy "intervention_reports_select" on public.intervention_reports
  for select using (
    exists (
      select 1 from public.interventions i
      where i.id = intervention_reports.intervention_id
        and i.company_id in (select public.user_company_ids())
        and (
          public.has_company_role(
            i.company_id,
            array['gerant', 'dispatcheur', 'commercial', 'comptable']
          )
          or i.assigned_to = auth.uid()
        )
    )
  );

create policy "intervention_reports_insert" on public.intervention_reports
  for insert with check (
    company_id in (select public.user_company_ids())
    and exists (
      select 1 from public.interventions i
      where i.id = intervention_reports.intervention_id
        and i.company_id = intervention_reports.company_id
        and (
          public.has_company_role(
            i.company_id,
            array['gerant', 'dispatcheur', 'commercial', 'comptable']
          )
          or i.assigned_to = auth.uid()
        )
    )
  );

create policy "intervention_reports_update" on public.intervention_reports
  for update using (
    exists (
      select 1 from public.interventions i
      where i.id = intervention_reports.intervention_id
        and i.company_id in (select public.user_company_ids())
        and (
          public.has_company_role(
            i.company_id,
            array['gerant', 'dispatcheur', 'commercial', 'comptable']
          )
          or i.assigned_to = auth.uid()
        )
    )
  )
  with check (
    company_id in (select public.user_company_ids())
    and exists (
      select 1 from public.interventions i
      where i.id = intervention_reports.intervention_id
        and i.company_id = intervention_reports.company_id
        and (
          public.has_company_role(
            i.company_id,
            array['gerant', 'dispatcheur', 'commercial', 'comptable']
          )
          or i.assigned_to = auth.uid()
        )
    )
  );

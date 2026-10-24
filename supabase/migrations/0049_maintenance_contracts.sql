-- ============================================================
-- 0049 : OREN ENTREPRISE — contrats de maintenance récurrents (axe 5)
--
-- Un contrat lie un client à des visites périodiques (mensuel →
-- annuel). Numéro CTR-NNN. Depuis un contrat, on GÉNÈRE une
-- intervention planifiée à l'échéance puis on avance l'échéance
-- (RPC atomique `generate_contract_visit`). L'auto-génération par cron
-- est différée — ici déclenchement manuel + repère « échéance proche ».
-- ============================================================

-- Compteur partagé : ajoute le type 'contrat'.
alter table public.document_counters
  drop constraint if exists document_counters_doc_type_check;
alter table public.document_counters
  add constraint document_counters_doc_type_check
  check (doc_type in (
    'devis', 'facture', 'proforma', 'intervention', 'rapport', 'contrat'
  ));

create table public.maintenance_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  number text,
  title text not null,
  description text not null default '',
  frequency text not null default 'mensuel'
    check (frequency in ('mensuel', 'trimestriel', 'semestriel', 'annuel')),
  -- montant facturable par échéance (FCFA, entier)
  amount integer not null default 0 check (amount >= 0),
  assigned_to uuid references auth.users (id) on delete set null,
  start_date date not null default current_date,
  end_date date,
  next_due date not null default current_date,
  status text not null default 'actif'
    check (status in ('actif', 'suspendu', 'termine')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index maintenance_contracts_company_idx
  on public.maintenance_contracts (company_id, next_due) where deleted_at is null;
create index maintenance_contracts_client_idx
  on public.maintenance_contracts (client_id) where deleted_at is null;

create trigger maintenance_contracts_updated_at
  before update on public.maintenance_contracts
  for each row execute function public.set_updated_at();

-- Numéro CTR- (même compteur atomique que le reste).
create or replace function public.next_contract_number(p_company_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_counter integer;
begin
  insert into public.document_counters (company_id, doc_type, counter)
  values (p_company_id, 'contrat', 1)
  on conflict (company_id, doc_type)
  do update set counter = public.document_counters.counter + 1
  returning counter into v_counter;
  return 'CTR-' || lpad(v_counter::text, 3, '0');
end;
$$;
revoke all on function public.next_contract_number(uuid) from public, anon, authenticated;

create or replace function public.set_contract_number()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.number is null then
    new.number := public.next_contract_number(new.company_id);
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_contracts_set_number on public.maintenance_contracts;
create trigger maintenance_contracts_set_number
  before insert on public.maintenance_contracts
  for each row execute function public.set_contract_number();

-- ------------------------------------------------------------
-- RLS — lecture par appartenance, gestion par le bureau
-- (gérant / dispatcheur). Pas de delete (soft delete via deleted_at).
-- ------------------------------------------------------------
alter table public.maintenance_contracts enable row level security;

create policy "maintenance_contracts_select" on public.maintenance_contracts
  for select using (company_id in (select public.user_company_ids()));
create policy "maintenance_contracts_insert" on public.maintenance_contracts
  for insert with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  );
create policy "maintenance_contracts_update" on public.maintenance_contracts
  for update using (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  )
  with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  );

-- ------------------------------------------------------------
-- generate_contract_visit : crée l'intervention de l'échéance et
-- avance next_due d'un pas. security definer (insère l'intervention
-- et met à jour le contrat atomiquement), réservé au bureau.
-- ------------------------------------------------------------
create or replace function public.generate_contract_visit(p_contract_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_contract public.maintenance_contracts;
  v_step interval;
  v_next date;
  v_address text;
  v_intervention_id uuid;
begin
  select * into v_contract
  from public.maintenance_contracts
  where id = p_contract_id and deleted_at is null;

  if not found then
    raise exception 'Contrat introuvable';
  end if;
  if not public.has_company_role(v_contract.company_id, array['gerant', 'dispatcheur']) then
    raise exception 'Action réservée au gérant ou au dispatcheur';
  end if;
  if v_contract.status <> 'actif' then
    raise exception 'Contrat non actif';
  end if;

  v_step := case v_contract.frequency
    when 'mensuel' then interval '1 month'
    when 'trimestriel' then interval '3 months'
    when 'semestriel' then interval '6 months'
    else interval '12 months'
  end;

  select address into v_address from public.clients where id = v_contract.client_id;

  insert into public.interventions (
    company_id, client_id, title, description, status,
    assigned_to, scheduled_at, address, created_by
  ) values (
    v_contract.company_id,
    v_contract.client_id,
    v_contract.title,
    v_contract.description,
    'planifiee',
    v_contract.assigned_to,
    (v_contract.next_due::timestamptz + interval '8 hours'),
    coalesce(v_address, ''),
    auth.uid()
  )
  returning id into v_intervention_id;

  v_next := (v_contract.next_due + v_step);
  update public.maintenance_contracts
  set next_due = v_next,
      status = case
        when end_date is not null and v_next > end_date then 'termine'
        else status
      end
  where id = p_contract_id;

  return v_intervention_id;
end;
$$;

revoke all on function public.generate_contract_visit(uuid) from public, anon;
grant execute on function public.generate_contract_visit(uuid) to authenticated;

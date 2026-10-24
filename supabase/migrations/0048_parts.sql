-- ============================================================
-- 0048 : OREN ENTREPRISE — pièces détachées & stock (axe 2)
--
-- `parts`  : le magasin de l'entreprise (une ligne = une référence de
--            pièce, avec un stock et un coût unitaire).
-- `intervention_parts` : les pièces posées sur une intervention
--            (snapshot nom/coût/quantité). Un trigger décrémente le
--            stock à la pose et le restitue au retrait.
--
-- Stock entreprise (pas encore par technicien — « van stock » différé).
-- Accès pièces posées = même cloisonnement que l'intervention (0045) :
-- le technicien saisit les pièces de SES interventions, le bureau gère
-- le magasin.
-- ============================================================

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  reference text not null default '',
  unit text not null default 'u',
  -- coût unitaire (FCFA, entier comme partout — cf. 0010)
  unit_price integer not null default 0 check (unit_price >= 0),
  -- stock courant : peut devenir négatif (pose au-delà du stock suivi)
  stock integer not null default 0,
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index parts_company_idx
  on public.parts (company_id) where deleted_at is null;

create trigger parts_updated_at
  before update on public.parts
  for each row execute function public.set_updated_at();

alter table public.parts enable row level security;

-- Lecture : tout membre (le technicien doit pouvoir choisir une pièce).
create policy "parts_select" on public.parts
  for select using (company_id in (select public.user_company_ids()));
-- Gestion du magasin : gérant / dispatcheur.
create policy "parts_insert" on public.parts
  for insert with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  );
create policy "parts_update" on public.parts
  for update using (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  )
  with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur'])
  );

-- ------------------------------------------------------------
-- Pièces posées sur une intervention.
-- ------------------------------------------------------------
create table public.intervention_parts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  intervention_id uuid not null
    references public.interventions (id) on delete cascade,
  -- on garde l'historique même si la référence est supprimée du magasin
  part_id uuid references public.parts (id) on delete set null,
  name text not null,
  unit text not null default 'u',
  unit_price integer not null default 0 check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index intervention_parts_intervention_idx
  on public.intervention_parts (intervention_id);
create index intervention_parts_part_idx
  on public.intervention_parts (part_id);

alter table public.intervention_parts enable row level security;

-- Accès = accès à l'intervention porteuse (bureau OU technicien affecté).
-- EXISTS car pas de cascade de policy à travers la jointure (cf. 0046).
create policy "intervention_parts_select" on public.intervention_parts
  for select using (
    exists (
      select 1 from public.interventions i
      where i.id = intervention_parts.intervention_id
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

create policy "intervention_parts_insert" on public.intervention_parts
  for insert with check (
    company_id in (select public.user_company_ids())
    and exists (
      select 1 from public.interventions i
      where i.id = intervention_parts.intervention_id
        and i.company_id = intervention_parts.company_id
        and (
          public.has_company_role(i.company_id, array['gerant', 'dispatcheur'])
          or i.assigned_to = auth.uid()
        )
    )
  );

create policy "intervention_parts_delete" on public.intervention_parts
  for delete using (
    exists (
      select 1 from public.interventions i
      where i.id = intervention_parts.intervention_id
        and i.company_id in (select public.user_company_ids())
        and (
          public.has_company_role(i.company_id, array['gerant', 'dispatcheur'])
          or i.assigned_to = auth.uid()
        )
    )
  );

-- ------------------------------------------------------------
-- Décrément / restitution du stock (security definer : la pose par un
-- technicien, qui n'a pas le droit d'écrire `parts`, doit quand même
-- bouger le stock).
-- ------------------------------------------------------------
create or replace function public.adjust_part_stock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.part_id is not null then
      update public.parts set stock = stock - new.quantity where id = new.part_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.part_id is not null then
      update public.parts set stock = stock + old.quantity where id = old.part_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.part_id is not null then
      update public.parts set stock = stock + old.quantity where id = old.part_id;
    end if;
    if new.part_id is not null then
      update public.parts set stock = stock - new.quantity where id = new.part_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

create trigger intervention_parts_stock
  after insert or update or delete on public.intervention_parts
  for each row execute function public.adjust_part_stock();

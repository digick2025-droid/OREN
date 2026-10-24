-- ============================================================
-- 0050 : OREN ENTREPRISE — dépenses & trésorerie (axe 3)
--
-- Les sorties d'argent de l'entreprise (achats, carburant, sous-
-- traitance…), éventuellement rattachées à une intervention pour
-- mesurer la marge « coût vs facturé ». Le calcul trésorerie/marge est
-- fait côté app à partir de : factures (documents), pièces posées
-- (0048) et ces dépenses.
--
-- Donnée financière → réservée aux rôles bureau financiers
-- (gérant / dispatcheur / comptable). Le technicien n'y a pas accès.
-- ============================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- rattachement facultatif à une intervention (attribution de coût)
  intervention_id uuid references public.interventions (id) on delete set null,
  label text not null,
  category text not null default '',
  supplier text not null default '',
  amount integer not null default 0 check (amount >= 0),
  expense_date date not null default current_date,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_company_date_idx
  on public.expenses (company_id, expense_date desc) where deleted_at is null;
create index expenses_intervention_idx
  on public.expenses (intervention_id) where deleted_at is null;

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

-- Lecture + écriture réservées aux rôles financiers. has_company_role
-- compte le propriétaire comme gérant, donc le propriétaire est couvert.
create policy "expenses_select" on public.expenses
  for select using (
    public.has_company_role(company_id, array['gerant', 'dispatcheur', 'comptable'])
  );
create policy "expenses_insert" on public.expenses
  for insert with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur', 'comptable'])
  );
create policy "expenses_update" on public.expenses
  for update using (
    public.has_company_role(company_id, array['gerant', 'dispatcheur', 'comptable'])
  )
  with check (
    public.has_company_role(company_id, array['gerant', 'dispatcheur', 'comptable'])
  );

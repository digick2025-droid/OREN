-- ============================================================
-- 0033 : témoignages clients, gérés depuis /admin, affichés sur
-- la landing (preuve sociale). Jamais de contenu inventé côté
-- app : tant qu'aucune ligne n'est active, le bloc ne s'affiche
-- pas (cf. src/components/landing/testimonials.tsx).
-- ============================================================

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  quote text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

-- Contenu public non sensible : tout le monde (visiteurs anonymes
-- inclus) peut lire les témoignages actifs, jamais l'historique.
create policy "testimonials_select_active" on public.testimonials
  for select using (is_active = true);

create policy "testimonials_admin_all" on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

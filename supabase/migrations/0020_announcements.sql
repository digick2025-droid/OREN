-- ============================================================
-- 0020 : bannière d'annonce globale, gérée depuis /admin, affichée
-- à tous les utilisateurs connectés sans déploiement.
-- ============================================================

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info' check (level in ('info', 'warning')),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Config non sensible, lisible par tous (même logique que
-- plans_select_all) : un utilisateur ne voit que l'annonce active
-- du moment, jamais l'historique.
create policy "announcements_select_active" on public.announcements
  for select using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "announcements_admin_all" on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

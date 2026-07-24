-- 0026 — Métier de l'entreprise
--
-- Sert à pré-remplir le catalogue (offres avec la feature `catalog`) et à
-- proposer des suggestions de lignes aux autres offres. Nullable : les comptes
-- existants n'en ont pas, et le parcours Express (anonyme) n'écrit jamais cette
-- valeur en base — le métier choisi y vit uniquement côté navigateur.

alter table public.companies
  add column if not exists metier text;

-- Idempotence : même pattern que 0013 (Postgres n'a pas de
-- `add constraint if not exists`).
alter table public.companies
  drop constraint if exists companies_metier_check;

alter table public.companies
  add constraint companies_metier_check
  check (metier is null or metier in (
    'electricien', 'plombier', 'menuisier', 'peintre', 'climaticien', 'general'
  ));

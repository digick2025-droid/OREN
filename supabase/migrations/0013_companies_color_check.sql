-- ============================================================
-- OREN — M3 : contrainte CHECK sur companies.color
--
-- `color` est injectée telle quelle dans les documents / PDF
-- (styles inline). On garantit un format hexadécimal valide
-- (#RGB ou #RRGGBB) pour éviter toute valeur inattendue.
-- ============================================================

-- Normalise d'éventuelles valeurs non conformes avant de contraindre
-- (repli sur la couleur de marque par défaut).
update public.companies
set color = '#131F35'
where color !~* '^#([0-9a-f]{3}|[0-9a-f]{6})$';

alter table public.companies
  drop constraint if exists companies_color_hex_check;

alter table public.companies
  add constraint companies_color_hex_check
  check (color ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$');

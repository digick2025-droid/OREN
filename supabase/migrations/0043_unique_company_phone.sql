-- ============================================================
-- 0043 : un numéro de téléphone = une seule entreprise.
--
-- L'e-mail est déjà unique (Supabase Auth) et un compte n'a qu'une
-- entreprise (companies_one_per_owner), mais rien n'empêchait de recréer
-- un compte avec une autre adresse et le même numéro — pour retrouver les
-- documents gratuits du mois ou gagner des parrainages.
--
-- Le numéro est comparé sous une forme canonique (chiffres, indicatif
-- inclus) : « 6 90 00 00 00 », « +237 690000000 » et « 00237690000000 »
-- sont le même numéro. `phone` et `whatsapp` sont croisés : le WhatsApp
-- d'une entreprise ne peut pas être le téléphone d'une autre. Une même
-- entreprise peut évidemment mettre le même numéro dans les deux champs.
--
-- Pas de contrainte d'unicité classique : elle porterait sur une seule
-- colonne. Un trigger vérifie les deux, sous verrou consultatif par
-- numéro pour que deux inscriptions simultanées ne passent pas toutes les
-- deux.
--
-- Les doublons déjà en base ne sont pas touchés : le contrôle ne joue
-- que quand un numéro est saisi ou modifié. Pour les lister :
--   select public.phone_key(coalesce(phone, whatsapp)) as numero,
--          array_agg(name) as entreprises
--   from public.companies where deleted_at is null
--   group by 1 having count(*) > 1 and public.phone_key(coalesce(phone, whatsapp)) is not null;
-- ============================================================

-- Forme canonique, alignée sur toInternationalPhone (src/services/whatsapp.ts) :
-- chiffres seuls, préfixe 00 retiré, indicatif 237 ajouté au numéro local.
-- null si le numéro est vide ou trop court pour être comparé.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(d) < 8 then null
    when p_phone ~ '^\s*\+' then d
    when d like '00%' then substr(d, 3)
    when d like '237%' and length(d) > 9 then d
    else '237' || ltrim(d, '0')
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) s;
$$;

create index if not exists companies_phone_key_idx
  on public.companies (public.phone_key(phone))
  where deleted_at is null and phone is not null;

create index if not exists companies_whatsapp_key_idx
  on public.companies (public.phone_key(whatsapp))
  where deleted_at is null and whatsapp is not null;

create or replace function public.assert_company_phone_unique()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_key text;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  foreach v_key in array array[public.phone_key(new.phone), public.phone_key(new.whatsapp)]
  loop
    continue when v_key is null;
    -- Numéro inchangé : une entreprise qui partageait déjà son numéro
    -- avant cette migration peut continuer à modifier ses autres champs.
    -- (Une entreprise restaurée, elle, est revérifiée.)
    continue when tg_op = 'UPDATE'
      and old.deleted_at is null
      and v_key in (
        coalesce(public.phone_key(old.phone), ''),
        coalesce(public.phone_key(old.whatsapp), '')
      );

    perform pg_advisory_xact_lock(hashtext('company_phone:' || v_key));

    if exists (
      select 1 from public.companies c
      where c.id <> new.id
        and c.deleted_at is null
        and (public.phone_key(c.phone) = v_key or public.phone_key(c.whatsapp) = v_key)
    ) then
      raise exception 'PHONE_TAKEN' using errcode = '23505';
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.assert_company_phone_unique() from anon, authenticated, public;

drop trigger if exists companies_phone_unique on public.companies;
create trigger companies_phone_unique
  before insert or update of phone, whatsapp, deleted_at on public.companies
  for each row execute function public.assert_company_phone_unique();

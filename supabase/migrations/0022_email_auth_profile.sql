-- ============================================================
-- OREN — Support authentification email + mot de passe
-- Met à jour handle_new_user pour capturer full_name depuis
-- les métadonnées utilisateur (inscription email).
-- Les utilisateurs téléphone existants ne sont pas impactés.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    new.phone,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

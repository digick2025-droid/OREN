-- ============================================================
-- 0028 : confirmation manuelle d'email depuis l'admin.
--
-- Constat : un compte inscrit qui ne clique jamais le lien de
-- confirmation reste bloqué (Supabase Auth refuse la connexion
-- tant que email_confirmed_at est nul), et l'entreprise n'est
-- jamais créée puisque auto-onboard tourne à la 1re session.
-- L'admin peut désormais confirmer l'email à la place de
-- l'utilisateur (support par téléphone / WhatsApp).
--
-- Note : auth.users.confirmed_at est une colonne GENERATED
-- (least(email_confirmed_at, phone_confirmed_at)) — on ne touche
-- que email_confirmed_at. confirmation_token est vidé comme le
-- fait GoTrue, pour neutraliser le lien envoyé par email.
--
-- Retour scalaire volontaire : un RETURNS TABLE (…, email_confirmed_at)
-- rendrait la colonne auth.users.email_confirmed_at ambiguë avec le
-- paramètre OUT du même nom — c'est le 42702 qui avait vidé les listes
-- admin en 0025, et un corps plpgsql n'est pas validé au déploiement.
-- ============================================================

create or replace function public.admin_confirm_user_email(p_user_id uuid)
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text;
  v_confirmed_at timestamptz;
  v_company_id uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select u.email::text, u.email_confirmed_at
  into v_email, v_confirmed_at
  from auth.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_email is null then
    raise exception 'NO_EMAIL';
  end if;

  -- idempotent : un email déjà confirmé garde sa date d'origine
  if v_confirmed_at is null then
    v_confirmed_at := now();

    update auth.users u
    set email_confirmed_at = v_confirmed_at,
        confirmation_token = ''
    where u.id = p_user_id;

    select c.id into v_company_id from public.companies c
    where c.owner_id = p_user_id and c.deleted_at is null
    limit 1;

    insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (
      v_company_id, auth.uid(),
      'user.email_confirmed', 'user', p_user_id,
      jsonb_build_object('email', v_email, 'manual', true)
    );
  end if;

  return v_confirmed_at;
end;
$$;

revoke execute on function public.admin_confirm_user_email(uuid) from anon, public;
grant execute on function public.admin_confirm_user_email(uuid) to authenticated;

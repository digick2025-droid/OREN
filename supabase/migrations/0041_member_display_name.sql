-- ============================================================
-- 0041 : OREN ENTREPRISE — nom d'affichage des membres
--
-- Un membre invité par téléphone n'a pas de nom tant qu'il n'a pas
-- rempli son profil → il s'affichait « Membre ». On permet au gérant
-- de donner un NOM à l'invitation, reporté sur le membre et affiché
-- partout (équipe, affectation des interventions).
-- ============================================================

alter table public.company_members
  add column if not exists display_name text;
alter table public.company_invitations
  add column if not exists display_name text;

-- ------------------------------------------------------------
-- invite_member : nouveau paramètre p_name (nom d'affichage).
-- Changement de signature → on drop l'ancienne (uuid,text,text).
-- ------------------------------------------------------------
drop function if exists public.invite_member(uuid, text, text);

create or replace function public.invite_member(
  p_company_id uuid,
  p_phone text,
  p_role text,
  p_name text default null
)
returns public.company_invitations
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.company_invitations%rowtype;
  v_phone text := nullif(trim(p_phone), '');
  v_name text := nullif(trim(p_name), '');
begin
  if not public.has_company_role(p_company_id, array['gerant']) then
    raise exception 'FORBIDDEN';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE';
  end if;
  if p_role not in ('dispatcheur', 'commercial', 'technicien', 'comptable') then
    raise exception 'INVALID_ROLE';
  end if;

  update public.company_invitations
  set role = p_role, status = 'pending', invited_by = auth.uid(),
      display_name = v_name, updated_at = now()
  where company_id = p_company_id and phone = v_phone and status = 'pending'
  returning * into v_inv;

  if not found then
    insert into public.company_invitations (company_id, phone, role, invited_by, display_name)
    values (p_company_id, v_phone, p_role, auth.uid(), v_name)
    returning * into v_inv;
  end if;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, auth.uid(), 'member.invited', 'invitation', v_inv.id,
          jsonb_build_object('phone', v_phone, 'role', p_role, 'name', v_name));

  return v_inv;
end;
$$;
revoke execute on function public.invite_member(uuid, text, text, text) from anon, public;
grant execute on function public.invite_member(uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- claim_invitations : reporte le nom de l'invitation sur le membre.
-- ------------------------------------------------------------
create or replace function public.claim_invitations()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_phone text;
  v_inv public.company_invitations%rowtype;
  v_count integer := 0;
begin
  select phone into v_phone from public.profiles where id = auth.uid();
  if v_phone is null then
    return 0;
  end if;

  for v_inv in
    select * from public.company_invitations
    where phone = v_phone and status = 'pending'
  loop
    insert into public.company_members (company_id, user_id, role, status, display_name)
    values (v_inv.company_id, auth.uid(), v_inv.role, 'active', v_inv.display_name)
    on conflict (company_id, user_id) where deleted_at is null
    do update set role = excluded.role, status = 'active', deleted_at = null,
                  display_name = coalesce(excluded.display_name, public.company_members.display_name);

    update public.company_invitations set status = 'accepted', updated_at = now()
    where id = v_inv.id;

    insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
    values (v_inv.company_id, auth.uid(), 'member.joined', 'member', v_inv.id,
            jsonb_build_object('role', v_inv.role));

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.claim_invitations() from anon, public;
grant execute on function public.claim_invitations() to authenticated;

-- ------------------------------------------------------------
-- list_company_members : nom = display_name du membre, sinon profil,
-- sinon owner_name (pour le propriétaire).
-- ------------------------------------------------------------
create or replace function public.list_company_members(p_company_id uuid)
returns table (
  user_id uuid,
  role text,
  status text,
  full_name text,
  phone text,
  is_owner boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if p_company_id not in (select public.user_company_ids()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select m.user_id, m.role, m.status,
         coalesce(
           m.display_name,
           pr.full_name,
           case when c.owner_id = m.user_id then c.owner_name end
         ) as full_name,
         pr.phone,
         (c.owner_id = m.user_id) as is_owner, m.created_at
  from public.company_members m
  join public.companies c on c.id = m.company_id
  left join public.profiles pr on pr.id = m.user_id
  where m.company_id = p_company_id and m.deleted_at is null
  order by (c.owner_id = m.user_id) desc, m.created_at;
end;
$$;
revoke execute on function public.list_company_members(uuid) from anon, public;
grant execute on function public.list_company_members(uuid) to authenticated;

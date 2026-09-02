-- Keep anonymous per-board ownership, and add one explicit personal-owner key
-- for editing or deleting any board. The raw key is never stored in the database.
create table private.tier_admin_credentials (
  singleton boolean primary key default true check (singleton),
  key_hash bytea not null,
  updated_at timestamptz not null default pg_catalog.now()
);

revoke all on private.tier_admin_credentials from public, anon, authenticated;

create function private.is_tier_admin(p_admin_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_admin_key is not null
    and pg_catalog.octet_length(p_admin_key) between 32 and 256
    and exists (
      select 1
      from private.tier_admin_credentials as credential
      where credential.singleton
        and credential.key_hash = extensions.digest(p_admin_key, 'sha256')
    );
$$;

revoke all on function private.is_tier_admin(text) from public, anon, authenticated;

create function public.verify_tier_admin(p_admin_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_tier_admin(p_admin_key);
$$;

create function private.replace_tier_board(
  p_board_id uuid,
  p_board jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_tier_board_input(p_board);

  update public.tier_boards
  set title = pg_catalog.btrim(p_board->>'title'),
      category = pg_catalog.btrim(p_board->>'category'),
      description = nullif(pg_catalog.btrim(p_board->>'description'), ''),
      is_public = coalesce((p_board->>'is_public')::boolean, true),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_board_id and updated_at = p_expected_updated_at;

  if not found then
    if exists (select 1 from public.tier_boards where id = p_board_id) then
      raise exception 'board was updated in another tab; reload before saving'
        using errcode = '40001';
    end if;
    raise exception 'board not found' using errcode = '42501';
  end if;

  delete from public.tier_rows where board_id = p_board_id;
  perform private.insert_tier_board_rows(p_board_id, p_board->'rows');
  return private.tier_board_json(p_board_id);
end;
$$;

revoke all on function private.replace_tier_board(uuid, jsonb, timestamptz)
from public, anon, authenticated;

create or replace function public.save_tier_board(
  p_board_id uuid,
  p_board jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tier_boards
    where id = p_board_id and owner_id = auth.uid()
  ) then
    raise exception 'board not found or not owned by current user' using errcode = '42501';
  end if;
  return private.replace_tier_board(p_board_id, p_board, p_expected_updated_at);
end;
$$;

create function public.admin_save_tier_board(
  p_board_id uuid,
  p_board jsonb,
  p_expected_updated_at timestamptz,
  p_admin_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tier_admin(p_admin_key) then
    raise exception 'invalid admin key' using errcode = '42501';
  end if;
  return private.replace_tier_board(p_board_id, p_board, p_expected_updated_at);
end;
$$;

create function public.admin_delete_tier_board(
  p_board_id uuid,
  p_admin_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_id uuid;
begin
  if not private.is_tier_admin(p_admin_key) then
    raise exception 'invalid admin key' using errcode = '42501';
  end if;

  delete from public.tier_boards
  where id = p_board_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'board not found' using errcode = '42501';
  end if;
  return v_deleted_id;
end;
$$;

revoke all on function public.verify_tier_admin(text) from public;
revoke all on function public.admin_save_tier_board(uuid, jsonb, timestamptz, text) from public;
revoke all on function public.admin_delete_tier_board(uuid, text) from public;

grant execute on function public.verify_tier_admin(text) to anon, authenticated;
grant execute on function public.admin_save_tier_board(uuid, jsonb, timestamptz, text) to anon, authenticated;
grant execute on function public.admin_delete_tier_board(uuid, text) to anon, authenticated;

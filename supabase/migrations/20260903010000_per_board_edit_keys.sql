-- Let every anonymous creator choose a board-scoped edit key. Only a bcrypt hash
-- of a SHA-256 prehash is kept in the private schema, avoiding bcrypt truncation.
create table private.tier_board_edit_credentials (
  board_id uuid primary key references public.tier_boards(id) on delete cascade,
  key_hash text not null,
  updated_at timestamptz not null default pg_catalog.now()
);

revoke all on private.tier_board_edit_credentials from public, anon, authenticated;

create function private.assert_tier_edit_key(p_edit_key text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_edit_key is null
    or p_edit_key <> pg_catalog.btrim(p_edit_key)
    or pg_catalog.char_length(p_edit_key) not between 8 and 100 then
    raise exception 'edit key must be between 8 and 100 characters without surrounding spaces'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_tier_edit_key(text) from public, anon, authenticated;

create function private.is_tier_board_editor(p_board_id uuid, p_edit_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_valid boolean := false;
begin
  if p_edit_key is null or pg_catalog.char_length(p_edit_key) not between 8 and 100 then
    return false;
  end if;

  select exists (
    select 1
    from private.tier_board_edit_credentials as credential
    where credential.board_id = p_board_id
      and extensions.crypt(
        pg_catalog.encode(extensions.digest(p_edit_key, 'sha256'), 'hex'),
        credential.key_hash
      ) = credential.key_hash
  ) into v_valid;

  return v_valid or private.is_tier_admin(p_edit_key);
end;
$$;

revoke all on function private.is_tier_board_editor(uuid, text) from public, anon, authenticated;

drop function public.create_tier_board(jsonb);
create function public.create_tier_board(p_board jsonb, p_edit_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_board_id uuid;
  v_slug text;
  v_base text;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_id::text, 0));
  if (select pg_catalog.count(*) from public.tier_boards where owner_id = v_owner_id) >= 25 then
    raise exception 'board limit reached' using errcode = '54000';
  end if;
  perform private.assert_tier_board_input(p_board);
  perform private.assert_tier_edit_key(p_edit_key);

  v_base := pg_catalog.lower(pg_catalog.regexp_replace(
    pg_catalog.btrim(p_board->>'title'), '[^a-zA-Z0-9]+', '-', 'g'
  ));
  v_base := pg_catalog.btrim(v_base, '-');
  if v_base = '' then v_base := 'tier'; end if;
  v_slug := pg_catalog.left(v_base, 72) || '-' || pg_catalog.substr(
    pg_catalog.replace(extensions.gen_random_uuid()::text, '-', ''), 1, 10
  );

  insert into public.tier_boards (
    slug, title, category, description, owner_id, is_public
  ) values (
    v_slug,
    pg_catalog.btrim(p_board->>'title'),
    pg_catalog.btrim(p_board->>'category'),
    nullif(pg_catalog.btrim(p_board->>'description'), ''),
    v_owner_id,
    coalesce((p_board->>'is_public')::boolean, true)
  ) returning id into v_board_id;

  insert into private.tier_board_edit_credentials (board_id, key_hash)
  values (
    v_board_id,
    extensions.crypt(
      pg_catalog.encode(extensions.digest(p_edit_key, 'sha256'), 'hex'),
      extensions.gen_salt('bf', 10)
    )
  );

  perform private.insert_tier_board_rows(v_board_id, p_board->'rows');
  return private.tier_board_json(v_board_id);
end;
$$;

create function public.verify_tier_board_key(p_board_id uuid, p_edit_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_tier_board_editor(p_board_id, p_edit_key);
$$;

create function public.key_save_tier_board(
  p_board_id uuid,
  p_board jsonb,
  p_expected_updated_at timestamptz,
  p_edit_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tier_board_editor(p_board_id, p_edit_key) then
    raise exception 'invalid edit key' using errcode = '42501';
  end if;
  return private.replace_tier_board(p_board_id, p_board, p_expected_updated_at);
end;
$$;

create function public.key_delete_tier_board(p_board_id uuid, p_edit_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_id uuid;
begin
  if not private.is_tier_board_editor(p_board_id, p_edit_key) then
    raise exception 'invalid edit key' using errcode = '42501';
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

revoke all on function public.create_tier_board(jsonb, text) from public, anon;
revoke all on function public.verify_tier_board_key(uuid, text) from public;
revoke all on function public.key_save_tier_board(uuid, jsonb, timestamptz, text) from public;
revoke all on function public.key_delete_tier_board(uuid, text) from public;

grant execute on function public.create_tier_board(jsonb, text) to authenticated;
grant execute on function public.verify_tier_board_key(uuid, text) to anon, authenticated;
grant execute on function public.key_save_tier_board(uuid, jsonb, timestamptz, text) to anon, authenticated;
grant execute on function public.key_delete_tier_board(uuid, text) to anon, authenticated;

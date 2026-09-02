-- Accept any non-empty board key up to the existing abuse-prevention limit,
-- and assign the requested simple key to the legacy movie seed board.
create or replace function private.assert_tier_edit_key(p_edit_key text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_edit_key is null
    or p_edit_key <> pg_catalog.btrim(p_edit_key)
    or pg_catalog.char_length(p_edit_key) not between 1 and 100 then
    raise exception 'edit key must be between 1 and 100 characters without surrounding spaces'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.is_tier_board_editor(p_board_id uuid, p_edit_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_valid boolean := false;
begin
  if p_edit_key is null or pg_catalog.char_length(p_edit_key) not between 1 and 100 then
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

insert into private.tier_board_edit_credentials (board_id, key_hash)
select
  board.id,
  extensions.crypt(
    pg_catalog.encode(extensions.digest('1234', 'sha256'), 'hex'),
    extensions.gen_salt('bf', 10)
  )
from public.tier_boards as board
where board.slug = 'space-movie-scores'
on conflict (board_id) do update
set key_hash = excluded.key_hash,
    updated_at = pg_catalog.now();

do $$
begin
  if not exists (
    select 1
    from private.tier_board_edit_credentials as credential
    join public.tier_boards as board on board.id = credential.board_id
    where board.slug = 'space-movie-scores'
  ) then
    raise exception 'movie seed board was not found' using errcode = '23503';
  end if;
end;
$$;

revoke all on function private.assert_tier_edit_key(text) from public, anon, authenticated;
revoke all on function private.is_tier_board_editor(uuid, text) from public, anon, authenticated;

-- Remove direct table writes and keep all mutations behind validated owner RPCs.
revoke insert, update, delete on public.tier_boards, public.tier_rows, public.tier_items from authenticated;

drop policy if exists "owners create boards" on public.tier_boards;
drop policy if exists "owners update boards" on public.tier_boards;
drop policy if exists "owners delete boards" on public.tier_boards;
drop policy if exists "owners create board rows" on public.tier_rows;
drop policy if exists "owners update board rows" on public.tier_rows;
drop policy if exists "owners delete board rows" on public.tier_rows;
drop policy if exists "owners create board items" on public.tier_items;
drop policy if exists "owners update board items" on public.tier_items;
drop policy if exists "owners delete board items" on public.tier_items;

create or replace function public.create_tier_board(p_board jsonb)
returns uuid
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

  perform private.insert_tier_board_rows(v_board_id, p_board->'rows');
  return v_board_id;
end;
$$;

create function public.delete_tier_board(p_board_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.tier_boards
  where id = p_board_id and owner_id = auth.uid()
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'board not found or not owned by current user' using errcode = '42501';
  end if;
  return v_deleted_id;
end;
$$;

revoke all on function public.delete_tier_board(uuid) from public, anon;
grant execute on function public.delete_tier_board(uuid) to authenticated;

-- Reject malformed nested payloads, return mutations atomically, and prevent stale saves.
create or replace function private.assert_tier_board_input(p_board jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_item jsonb;
  v_item_count integer := 0;
  v_labels text[] := array[]::text[];
  v_label text;
  v_score numeric;
begin
  if p_board is null or pg_catalog.jsonb_typeof(p_board) is distinct from 'object' then
    raise exception 'board must be a JSON object' using errcode = '23514';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_board->>'title', ''))) not between 1 and 80 then
    raise exception 'title must be between 1 and 80 characters' using errcode = '23514';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_board->>'category', ''))) not between 1 and 40 then
    raise exception 'category must be between 1 and 40 characters' using errcode = '23514';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_board->>'description', ''))) > 500 then
    raise exception 'description must be at most 500 characters' using errcode = '23514';
  end if;
  if p_board ? 'is_public' and pg_catalog.jsonb_typeof(p_board->'is_public') is distinct from 'boolean' then
    raise exception 'is_public must be a boolean' using errcode = '23514';
  end if;
  if pg_catalog.jsonb_typeof(p_board->'rows') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_board->'rows') not between 1 and 20 then
    raise exception 'rows must contain between 1 and 20 entries' using errcode = '23514';
  end if;

  for v_row in
    select entry.value
    from pg_catalog.jsonb_array_elements(p_board->'rows') as entry(value)
  loop
    if pg_catalog.jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'each row must be a JSON object' using errcode = '23514';
    end if;
    v_label := pg_catalog.lower(pg_catalog.btrim(coalesce(v_row->>'label', '')));
    if pg_catalog.char_length(v_label) not between 1 and 30 then
      raise exception 'row labels must be between 1 and 30 characters' using errcode = '23514';
    end if;
    if v_label = any(v_labels) then
      raise exception 'row labels must be unique' using errcode = '23514';
    end if;
    v_labels := pg_catalog.array_append(v_labels, v_label);
    if coalesce(v_row->>'color', '') !~ '^#[0-9A-Fa-f]{6}$' then
      raise exception 'row colors must be six-digit hex values' using errcode = '23514';
    end if;
    if pg_catalog.jsonb_typeof(v_row->'items') is distinct from 'array' then
      raise exception 'row items must be an array' using errcode = '23514';
    end if;

    v_item_count := v_item_count + pg_catalog.jsonb_array_length(v_row->'items');
    if v_item_count > 200 then
      raise exception 'a board may contain at most 200 items' using errcode = '23514';
    end if;

    for v_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(v_row->'items') as entry(value)
    loop
      if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
        or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_item->>'title', ''))) not between 1 and 100 then
        raise exception 'item titles must be between 1 and 100 characters' using errcode = '23514';
      end if;
      if pg_catalog.char_length(pg_catalog.btrim(coalesce(v_item->>'note', ''))) > 300 then
        raise exception 'item notes must be at most 300 characters' using errcode = '23514';
      end if;
      if v_item ? 'score' and pg_catalog.jsonb_typeof(v_item->'score') not in ('number', 'null') then
        raise exception 'item scores must be numbers or null' using errcode = '23514';
      end if;
      if pg_catalog.jsonb_typeof(v_item->'score') = 'number' then
        v_score := (v_item->>'score')::numeric;
        if v_score < 0 or v_score > 10 or v_score * 10 <> pg_catalog.trunc(v_score * 10) then
          raise exception 'item scores must be between 0 and 10 in 0.1 increments' using errcode = '23514';
        end if;
      end if;
    end loop;
  end loop;
end;
$$;

create function private.tier_board_json(p_board_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', board.id,
    'slug', board.slug,
    'title', board.title,
    'category', board.category,
    'description', board.description,
    'owner_id', board.owner_id,
    'is_public', board.is_public,
    'created_at', board.created_at,
    'updated_at', board.updated_at,
    'tier_rows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', row.id,
          'label', row.label,
          'color', row.color,
          'position', row.position,
          'tier_items', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', item.id,
                'title', item.title,
                'note', item.note,
                'score', item.score,
                'position', item.position
              ) order by item.position
            )
            from public.tier_items as item
            where item.row_id = row.id and item.board_id = board.id
          ), '[]'::jsonb)
        ) order by row.position
      )
      from public.tier_rows as row
      where row.board_id = board.id
    ), '[]'::jsonb)
  )
  from public.tier_boards as board
  where board.id = p_board_id;
$$;

revoke all on function private.tier_board_json(uuid) from public, anon, authenticated;

drop function public.create_tier_board(jsonb);
create function public.create_tier_board(p_board jsonb)
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
  return private.tier_board_json(v_board_id);
end;
$$;

drop function public.save_tier_board(uuid, jsonb);
create function public.save_tier_board(
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
  perform private.assert_tier_board_input(p_board);

  update public.tier_boards
  set title = pg_catalog.btrim(p_board->>'title'),
      category = pg_catalog.btrim(p_board->>'category'),
      description = nullif(pg_catalog.btrim(p_board->>'description'), ''),
      is_public = coalesce((p_board->>'is_public')::boolean, true),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_board_id
    and owner_id = auth.uid()
    and updated_at = p_expected_updated_at;

  if not found then
    if exists (
      select 1 from public.tier_boards
      where id = p_board_id and owner_id = auth.uid()
    ) then
      raise exception 'board was updated in another tab; reload before saving'
        using errcode = '40001';
    end if;
    raise exception 'board not found or not owned by current user' using errcode = '42501';
  end if;

  delete from public.tier_rows where board_id = p_board_id;
  perform private.insert_tier_board_rows(p_board_id, p_board->'rows');
  return private.tier_board_json(p_board_id);
end;
$$;

revoke all on function public.create_tier_board(jsonb) from public, anon;
revoke all on function public.save_tier_board(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.create_tier_board(jsonb) to authenticated;
grant execute on function public.save_tier_board(uuid, jsonb, timestamptz) to authenticated;

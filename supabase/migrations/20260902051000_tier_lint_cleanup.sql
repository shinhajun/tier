-- Keep the validation function free of an implicit text-to-text[] assignment.
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
begin
  if p_board is null or pg_catalog.jsonb_typeof(p_board) <> 'object' then
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
  if p_board ? 'is_public' and pg_catalog.jsonb_typeof(p_board->'is_public') <> 'boolean' then
    raise exception 'is_public must be a boolean' using errcode = '23514';
  end if;
  if pg_catalog.jsonb_typeof(p_board->'rows') <> 'array'
    or pg_catalog.jsonb_array_length(p_board->'rows') not between 1 and 20 then
    raise exception 'rows must contain between 1 and 20 entries' using errcode = '23514';
  end if;

  for v_row in
    select entry.value
    from pg_catalog.jsonb_array_elements(p_board->'rows') as entry(value)
  loop
    if pg_catalog.jsonb_typeof(v_row) <> 'object' then
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
    if pg_catalog.jsonb_typeof(v_row->'items') <> 'array' then
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
      if pg_catalog.jsonb_typeof(v_item) <> 'object'
        or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_item->>'title', ''))) not between 1 and 100 then
        raise exception 'item titles must be between 1 and 100 characters' using errcode = '23514';
      end if;
      if pg_catalog.char_length(pg_catalog.btrim(coalesce(v_item->>'note', ''))) > 300 then
        raise exception 'item notes must be at most 300 characters' using errcode = '23514';
      end if;
      if v_item ? 'score' and pg_catalog.jsonb_typeof(v_item->'score') not in ('number', 'null') then
        raise exception 'item scores must be numbers or null' using errcode = '23514';
      end if;
      if pg_catalog.jsonb_typeof(v_item->'score') = 'number'
        and ((v_item->>'score')::numeric < 0 or (v_item->>'score')::numeric > 10) then
        raise exception 'item scores must be between 0 and 10' using errcode = '23514';
      end if;
    end loop;
  end loop;
end;
$$;

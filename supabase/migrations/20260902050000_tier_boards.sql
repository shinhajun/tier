create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.tier_boards (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 100),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  category text not null check (char_length(btrim(category)) between 1 and 40),
  description text check (description is null or char_length(btrim(description)) <= 500),
  owner_id uuid references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tier_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  board_id uuid not null references public.tier_boards(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 30),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position smallint not null check (position between 0 and 19),
  unique (id, board_id),
  unique (board_id, position)
);

create unique index tier_rows_board_label_key
  on public.tier_rows (board_id, lower(btrim(label)));

create table public.tier_items (
  id uuid primary key default extensions.gen_random_uuid(),
  board_id uuid not null references public.tier_boards(id) on delete cascade,
  row_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  note text check (note is null or char_length(btrim(note)) <= 300),
  score numeric(3, 1) check (score is null or score between 0 and 10),
  position smallint not null check (position between 0 and 199),
  foreign key (row_id, board_id)
    references public.tier_rows(id, board_id) on delete cascade,
  unique (row_id, position)
);

create index tier_boards_public_updated_idx
  on public.tier_boards (updated_at desc) where is_public;
create index tier_rows_board_position_idx
  on public.tier_rows (board_id, position);
create index tier_items_board_row_position_idx
  on public.tier_items (board_id, row_id, position);

create function private.assert_tier_board_input(p_board jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_item jsonb;
  v_item_count integer := 0;
  v_labels text[] := '{}';
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

create function private.insert_tier_board_rows(p_board_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_item jsonb;
  v_row_id uuid;
  v_row_position integer := 0;
  v_item_position integer;
begin
  for v_row in
    select entry.value
    from pg_catalog.jsonb_array_elements(p_rows) as entry(value)
  loop
    insert into public.tier_rows (board_id, label, color, position)
    values (
      p_board_id,
      pg_catalog.btrim(v_row->>'label'),
      pg_catalog.upper(v_row->>'color'),
      v_row_position
    ) returning id into v_row_id;

    v_item_position := 0;
    for v_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(v_row->'items') as entry(value)
    loop
      insert into public.tier_items (board_id, row_id, title, note, score, position)
      values (
        p_board_id,
        v_row_id,
        pg_catalog.btrim(v_item->>'title'),
        nullif(pg_catalog.btrim(v_item->>'note'), ''),
        case when pg_catalog.jsonb_typeof(v_item->'score') = 'number'
          then (v_item->>'score')::numeric else null end,
        v_item_position
      );
      v_item_position := v_item_position + 1;
    end loop;
    v_row_position := v_row_position + 1;
  end loop;
end;
$$;

create function public.create_tier_board(p_board jsonb)
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

create function public.save_tier_board(p_board_id uuid, p_board jsonb)
returns uuid
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
      updated_at = pg_catalog.now()
  where id = p_board_id and owner_id = auth.uid();

  if not found then
    raise exception 'board not found or not owned by current user' using errcode = '42501';
  end if;

  delete from public.tier_rows where board_id = p_board_id;
  perform private.insert_tier_board_rows(p_board_id, p_board->'rows');
  return p_board_id;
end;
$$;

alter table public.tier_boards enable row level security;
alter table public.tier_rows enable row level security;
alter table public.tier_items enable row level security;

create policy "public boards are readable"
on public.tier_boards for select
using (is_public or owner_id = auth.uid());

create policy "owners create boards"
on public.tier_boards for insert to authenticated
with check (owner_id = auth.uid());

create policy "owners update boards"
on public.tier_boards for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners delete boards"
on public.tier_boards for delete to authenticated
using (owner_id = auth.uid());

create policy "readable board rows are readable"
on public.tier_rows for select
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and (b.is_public or b.owner_id = auth.uid())
));

create policy "owners create board rows"
on public.tier_rows for insert to authenticated
with check (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

create policy "owners update board rows"
on public.tier_rows for update to authenticated
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

create policy "owners delete board rows"
on public.tier_rows for delete to authenticated
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

create policy "readable board items are readable"
on public.tier_items for select
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and (b.is_public or b.owner_id = auth.uid())
));

create policy "owners create board items"
on public.tier_items for insert to authenticated
with check (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

create policy "owners update board items"
on public.tier_items for update to authenticated
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

create policy "owners delete board items"
on public.tier_items for delete to authenticated
using (exists (
  select 1 from public.tier_boards b
  where b.id = board_id and b.owner_id = auth.uid()
));

revoke all on public.tier_boards, public.tier_rows, public.tier_items from public;
grant select on public.tier_boards, public.tier_rows, public.tier_items to anon, authenticated;
grant insert, update, delete on public.tier_boards, public.tier_rows, public.tier_items to authenticated;

revoke all on function public.create_tier_board(jsonb) from public, anon;
revoke all on function public.save_tier_board(uuid, jsonb) from public, anon;
grant execute on function public.create_tier_board(jsonb) to authenticated;
grant execute on function public.save_tier_board(uuid, jsonb) to authenticated;

insert into public.tier_boards (
  id, slug, title, category, description, owner_id, is_public, created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000000001',
  'space-movie-scores',
  '우주와 미래를 그린 영화',
  '영화',
  '다시 보고 싶은 SF 영화를 10점 만점으로 정리했습니다.',
  null,
  true,
  '2026-09-02 00:00:00+00',
  '2026-09-02 00:00:00+00'
);

insert into public.tier_rows (id, board_id, label, color, position) values
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '9점',   '#F3C969', 0),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '8점',   '#EAA66B', 1),
  ('20000000-0000-4000-8000-000000000075', '10000000-0000-4000-8000-000000000001', '7.5점', '#8DBAA5', 2),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '7점',   '#7DA6C7', 3),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '6점',   '#9B91B6', 4);

insert into public.tier_items (board_id, row_id, title, note, score, position) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000009', '인터스텔라', null, 9, 0),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000009', '2001: 스페이스 오디세이', null, 9, 1),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000008', '프로젝트 헤일메리', null, 8, 0),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000075', '그래비티', null, 7.5, 0),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000075', '마션', null, 7.5, 1),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000007', '마이너리티 리포트', null, 7, 0),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000007', '스파이더맨: 어크로스 더 유니버스', null, 7, 1),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', '아바타: 물의 길', null, 6, 0);

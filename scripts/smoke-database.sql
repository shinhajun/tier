\set ON_ERROR_STOP on

begin;

do $$
declare
  v_owner uuid;
  v_outsider uuid;
  v_board jsonb;
  v_saved jsonb;
  v_board_id uuid;
  v_before integer;
  v_after integer;
  v_expected timestamptz;
  v_rejected boolean;
  v_payload jsonb := '{
    "title": "CI boundary smoke",
    "category": "검증",
    "description": "transaction rollback",
    "is_public": true,
    "rows": [
      {"label": "좋음", "color": "#183153", "items": [{"title": "검증 항목", "score": 8.5}]},
      {"label": "보통", "color": "#F8DF8B", "items": []}
    ]
  }'::jsonb;
begin
  select id into v_owner
  from auth.users
  where is_anonymous
  order by created_at desc
  limit 1;

  select id into v_outsider
  from auth.users
  where is_anonymous and id <> v_owner
  order by created_at desc
  limit 1;

  if v_owner is null or v_outsider is null then
    raise exception 'two anonymous auth fixtures are required';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.tier_boards', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.tier_boards', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'public.tier_boards', 'DELETE') then
    raise exception 'authenticated direct board writes must stay revoked';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);

  select pg_catalog.count(*) into v_before from public.tier_boards;

  v_rejected := false;
  begin
    perform public.create_tier_board('{"title":"missing rows","category":"검증","is_public":true}'::jsonb);
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'missing rows payload was accepted'; end if;

  v_rejected := false;
  begin
    perform public.create_tier_board('{
      "title":"missing items","category":"검증","is_public":true,
      "rows":[{"label":"오류","color":"#183153"}]
    }'::jsonb);
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'missing items payload was accepted'; end if;

  v_rejected := false;
  begin
    perform public.create_tier_board('{
      "title":"precision","category":"검증","is_public":true,
      "rows":[{"label":"오류","color":"#183153","items":[{"title":"오류","score":7.55}]}]
    }'::jsonb);
  exception when check_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'invalid score precision was accepted'; end if;

  select pg_catalog.count(*) into v_after from public.tier_boards;
  if v_after <> v_before then raise exception 'malformed mutation changed board count'; end if;

  v_board := public.create_tier_board(v_payload);
  v_board_id := (v_board->>'id')::uuid;
  v_expected := (v_board->>'updated_at')::timestamptz;
  if v_board_id is null or v_board->>'slug' is null then
    raise exception 'create RPC did not return the persisted board';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_outsider::text, true);
  v_rejected := false;
  begin
    perform public.save_tier_board(v_board_id, v_payload, v_expected);
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'non-owner save was accepted'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_owner::text, true);
  v_saved := public.save_tier_board(
    v_board_id,
    pg_catalog.jsonb_set(v_payload, '{title}', '"owner write passed"'::jsonb),
    v_expected
  );
  if v_saved->>'title' <> 'owner write passed' then
    raise exception 'owner save did not return the saved board';
  end if;

  v_rejected := false;
  begin
    perform public.save_tier_board(v_board_id, v_payload, v_expected);
  exception when serialization_failure then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'stale save was accepted'; end if;

  v_rejected := false;
  begin
    perform public.save_tier_board(
      '10000000-0000-4000-8000-000000000001'::uuid,
      v_payload,
      '2026-09-02 00:00:00+00'::timestamptz
    );
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'seed mutation was accepted'; end if;

  if public.delete_tier_board(v_board_id) <> v_board_id then
    raise exception 'delete RPC returned an unexpected ID';
  end if;

  raise notice 'database boundary smoke passed';
end;
$$;

rollback;

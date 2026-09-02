-- Keep the public gallery bounded: 24 boards in the client, four row previews,
-- and three item titles per row instead of every nested item on every board.
create view public.tier_board_gallery
with (security_invoker = true)
as
select
  board.id,
  board.slug,
  board.title,
  board.category,
  board.description,
  board.updated_at,
  (
    select pg_catalog.count(*)
    from public.tier_items as item
    where item.board_id = board.id
  )::integer as item_count,
  coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', preview.id,
        'label', preview.label,
        'color', preview.color,
        'position', preview.position,
        'items', preview.items
      ) order by preview.position
    )
    from (
      select
        row.id,
        row.label,
        row.color,
        row.position,
        coalesce((
          select pg_catalog.jsonb_agg(item_preview.title order by item_preview.position)
          from (
            select item.title, item.position
            from public.tier_items as item
            where item.row_id = row.id and item.board_id = board.id
            order by item.position
            limit 3
          ) as item_preview
        ), '[]'::jsonb) as items
      from public.tier_rows as row
      where row.board_id = board.id
      order by row.position
      limit 4
    ) as preview
  ), '[]'::jsonb) as rows
from public.tier_boards as board
where board.is_public;

revoke all on public.tier_board_gallery from public;
grant select on public.tier_board_gallery to anon, authenticated;

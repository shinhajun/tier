-- Keep the owner's "latest Spider-Man / Avatar" entries current as of 2026-09-02.
update public.tier_items
set title = '스파이더맨: 브랜드 뉴 데이'
where board_id = '10000000-0000-4000-8000-000000000001'
  and title = '스파이더맨: 어크로스 더 유니버스';

update public.tier_items
set title = '아바타: 불과 재'
where board_id = '10000000-0000-4000-8000-000000000001'
  and title = '아바타: 물의 길';

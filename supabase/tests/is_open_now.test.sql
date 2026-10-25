begin;
create extension if not exists pgtap;
select plan(6);

-- Fixtures: three cities in three time zones, one place each (fixed literal UUIDs)
insert into public.cities (id, region_id, slug, name_i18n, timezone, center, status) values
  (9101, (select id from public.regions where slug = 'nsw'),      'oh-sydney',   '{"en":"Sydney"}',   'Australia/Sydney', 'SRID=4326;POINT(151.2093 -33.8688)', 'published'),
  (9102, (select id from public.regions where slug = 'nsw'),      'oh-perth',    '{"en":"Perth"}',    'Australia/Perth',  'SRID=4326;POINT(115.8605 -31.9505)', 'published'),
  (9103, (select id from public.regions where slug = 'auckland'), 'oh-auckland', '{"en":"Auckland"}', 'Pacific/Auckland', 'SRID=4326;POINT(174.7633 -36.8485)', 'published');

insert into public.places (id, city_id, slug, type, name_i18n, geom, status) values
  ('00000000-0000-0000-0000-00000000c001', 9101, 'oh-sydney-bar',   'bar',  '{"en":"Bar"}',  'SRID=4326;POINT(151.2093 -33.8688)', 'published'),
  ('00000000-0000-0000-0000-00000000c002', 9102, 'oh-perth-cafe',   'cafe', '{"en":"Cafe"}', 'SRID=4326;POINT(115.8605 -31.9505)', 'published'),
  ('00000000-0000-0000-0000-00000000c003', 9103, 'oh-akl-cafe',     'cafe', '{"en":"Cafe"}', 'SRID=4326;POINT(174.7633 -36.8485)', 'published');

insert into public.place_hours (place_id, weekday, open_time, close_time) values
  ('00000000-0000-0000-0000-00000000c001', 5, '18:00', '02:00'),  -- Fri 18:00-02:00 (after midnight)
  ('00000000-0000-0000-0000-00000000c002', 6, '08:00', '15:00'),  -- Sat 08:00-15:00
  ('00000000-0000-0000-0000-00000000c003', 6, '08:00', '15:00');  -- Sat 08:00-15:00

-- 2026-10-16 is a Friday. Sydney AEDT = UTC+11, Perth AWST = UTC+8, Auckland NZDT = UTC+13.
select is(is_open_now('00000000-0000-0000-0000-00000000c001', '2026-10-16 14:30Z'), true,  'Sat 01:30 AEDT open (after midnight)');
select is(is_open_now('00000000-0000-0000-0000-00000000c001', '2026-10-16 15:30Z'), false, 'Sat 02:30 AEDT closed');
select is(is_open_now('00000000-0000-0000-0000-00000000c001', '2026-10-16 06:30Z'), false, 'Fri 17:30 AEDT not yet open');
select is(is_open_now('00000000-0000-0000-0000-00000000c002', '2026-10-16 23:30Z'), false, 'Sat 07:30 AWST closed');
select is(is_open_now('00000000-0000-0000-0000-00000000c002', '2026-10-17 00:30Z'), true,  'Sat 08:30 AWST open');
select is(is_open_now('00000000-0000-0000-0000-00000000c003', '2026-10-16 21:00Z'), true,  'Sat 10:00 NZDT open');

select * from finish();
rollback;

begin;
create extension if not exists pgtap;
select plan(12);

-- a = user A, b = user B; two published places in Sydney.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'trip-a@example.com'),
  ('00000000-0000-0000-0000-0000000005b1', 'trip-b@example.com');
insert into public.places (id, city_id, slug, type, name_i18n, geom, status) values
  ('00000000-0000-0000-0000-00000000f001', (select id from public.cities where slug = 'sydney'), 'trip-p1', 'attraction', '{"en":"P1"}', 'SRID=4326;POINT(151.2 -33.8)', 'published'),
  ('00000000-0000-0000-0000-00000000f002', (select id from public.cities where slug = 'sydney'), 'trip-p2', 'attraction', '{"en":"P2"}', 'SRID=4326;POINT(151.21 -33.81)', 'published');

-- User A's trip: day 1 with stops s1, s2, s3; day 2 empty.
insert into public.trips (id, user_id, title) values ('00000000-0000-0000-0000-00000000a0a1', '00000000-0000-0000-0000-0000000005a1', 'A trip');
insert into public.trip_days (id, trip_id, day_no) values
  ('00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-00000000a0a1', 1),
  ('00000000-0000-0000-0000-00000000a1a2', '00000000-0000-0000-0000-00000000a0a1', 2);
insert into public.trip_stops (id, day_id, place_id, position) values
  ('00000000-0000-0000-0000-00000000a2a1', '00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-00000000f001', 1),
  ('00000000-0000-0000-0000-00000000a2a2', '00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-00000000f002', 2),
  ('00000000-0000-0000-0000-00000000a2a3', '00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-00000000f001', 3);

-- As user A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}';

select public.normalize_trip_day('00000000-0000-0000-0000-00000000a1a1');
select is((select count(*)::int from public.trip_legs), 2, 'normalize creates a stale leg per consecutive pair');
update public.trip_legs set status = 'ok' where from_stop = '00000000-0000-0000-0000-00000000a2a1';

select public.move_trip_stop('00000000-0000-0000-0000-00000000a2a2', '00000000-0000-0000-0000-00000000a1a2', 1);
select results_eq(
  $$ select position::int from public.trip_stops where day_id = '00000000-0000-0000-0000-00000000a1a1' order by position $$,
  $$ values (1), (2) $$,
  'moving a stop away keeps the old day contiguous'
);
select is(
  (select status from public.trip_legs where from_stop = '00000000-0000-0000-0000-00000000a2a1' and to_stop = '00000000-0000-0000-0000-00000000a2a3'),
  'stale',
  'the stops either side of the moved one get a new stale leg'
);
select is_empty(
  $$ select 1 from public.trip_legs where to_stop = '00000000-0000-0000-0000-00000000a2a2' or from_stop = '00000000-0000-0000-0000-00000000a2a2' $$,
  'legs to and from the moved stop on its old day are gone (it is alone on day 2)'
);

select public.move_trip_stop('00000000-0000-0000-0000-00000000a2a3', '00000000-0000-0000-0000-00000000a1a2', 1);
select results_eq(
  $$ select id::text from public.trip_stops where day_id = '00000000-0000-0000-0000-00000000a1a2' order by position $$,
  $$ values ('00000000-0000-0000-0000-00000000a2a3'), ('00000000-0000-0000-0000-00000000a2a2') $$,
  'moving to position 1 puts the stop first'
);

select isnt(public.create_trip('Three days', '2026-11-01', '2026-11-03'), null, 'create_trip returns the new id');
select is((select count(*)::int from public.trip_days d join public.trips t on t.id = d.trip_id where t.title = 'Three days'), 3, 'one day per date');
select throws_ok($$ select public.create_trip('Too long', '2026-01-01', '2026-03-15') $$, '22023', null, 'more than 60 days is refused');
select throws_ok($$ select public.create_trip('Backwards', '2026-11-03', '2026-11-01') $$, '23514', null, 'end before start is refused');
reset role;

-- User B's trip, then act as user A
insert into public.trips (id, user_id, title) values ('00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-0000000005b1', 'B trip');
insert into public.trip_days (id, trip_id, day_no) values ('00000000-0000-0000-0000-00000000b1b1', '00000000-0000-0000-0000-00000000b0b1', 1);
insert into public.trip_stops (id, day_id, place_id, position) values
  ('00000000-0000-0000-0000-00000000b2b1', '00000000-0000-0000-0000-00000000b1b1', '00000000-0000-0000-0000-00000000f001', 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}';
select throws_ok(
  $$ select public.move_trip_stop('00000000-0000-0000-0000-00000000b2b1', '00000000-0000-0000-0000-00000000a1a1', 1) $$,
  'P0002', null, 'user A cannot move user B''s stop'
);
select throws_ok(
  $$ select public.move_trip_stop('00000000-0000-0000-0000-00000000a2a1', '00000000-0000-0000-0000-00000000b1b1', 1) $$,
  'P0002', null, 'user A cannot move a stop into user B''s day'
);
select is_empty($$ select 1 from public.trip_stops where day_id = '00000000-0000-0000-0000-00000000b1b1' $$, 'user A sees none of user B''s stops');
reset role;

select * from finish();
rollback;

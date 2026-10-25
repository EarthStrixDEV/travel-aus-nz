begin;
create extension if not exists pgtap;
select plan(32);

-- Fixtures (as the connecting role, before any impersonation).
-- a1 = user A, b1 = user B, e1 = editor. Profiles are created by on_auth_user_created.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'rls-a@example.com'),
  ('00000000-0000-0000-0000-0000000004b1', 'rls-b@example.com'),
  ('00000000-0000-0000-0000-0000000004e1', 'rls-editor@example.com');
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-0000000004e1';

insert into public.places (id, city_id, slug, type, name_i18n, geom, status) values
  ('00000000-0000-0000-0000-00000000d001', (select id from public.cities where slug = 'sydney'), 'rls-published', 'cafe', '{"en":"Pub"}',   'SRID=4326;POINT(151.2 -33.8)', 'published'),
  ('00000000-0000-0000-0000-00000000d002', (select id from public.cities where slug = 'sydney'), 'rls-draft',     'cafe', '{"en":"Draft"}', 'SRID=4326;POINT(151.2 -33.8)', 'draft');

-- Children of published (…01) vs draft (…02) parents
insert into public.place_hours (place_id, weekday, open_time, close_time) values
  ('00000000-0000-0000-0000-00000000d001', 1, '09:00', '17:00'),
  ('00000000-0000-0000-0000-00000000d002', 1, '09:00', '17:00');
insert into public.collections (id, slug, kind, title_i18n, status) values
  ('00000000-0000-0000-0000-00000000c701', 'rls-col-pub',   'place', '{"en":"P"}', 'published'),
  ('00000000-0000-0000-0000-00000000c702', 'rls-col-draft', 'place', '{"en":"D"}', 'draft');
insert into public.collection_items (collection_id, entity_type, entity_id, position, note_i18n) values
  ('00000000-0000-0000-0000-00000000c701', 'place', '00000000-0000-0000-0000-00000000d001', 1, '{"en":"pub note"}'),
  ('00000000-0000-0000-0000-00000000c702', 'place', '00000000-0000-0000-0000-00000000d001', 1, '{"en":"secret note"}');
insert into public.dishes (id, slug, country, name_i18n, status) values
  ('00000000-0000-0000-0000-00000000a701', 'rls-dish-pub',   'AU', '{"en":"P"}', 'published'),
  ('00000000-0000-0000-0000-00000000a702', 'rls-dish-draft', 'AU', '{"en":"D"}', 'draft');
insert into public.dish_venues (dish_id, place_id, editor_note_i18n) values
  ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000d001', '{"en":"pub"}'),
  ('00000000-0000-0000-0000-00000000a702', '00000000-0000-0000-0000-00000000d001', '{"en":"secret"}');

insert into public.trips (id, user_id, title) values
  ('00000000-0000-0000-0000-00000000e0b1', '00000000-0000-0000-0000-0000000004b1', 'B trip');

insert into public.fx_rates (base, quote, rate, source, fetched_at)
values ('AUD', 'THB', 23.5, 'test', '2026-10-24 00:00Z');

-- Structure
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity $$,
  'every public table has RLS'
);
select is_empty(
  $$ select tablename from pg_policies where schemaname = 'public'
     and tablename in ('fx_rates','link_checks','audit_log','content_feedback') $$,
  'service-only tables have no policies'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.is_editor()'::regprocedure),
  true, 'is_editor is security definer'
);

-- Guest (anon)
set local role anon;
select results_eq(
  $$ select count(*)::int from public.places where id in ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-00000000d002') $$,
  array[1], 'anon sees the published place only'
);
select is_empty(
  $$ select 1 from public.places where id = '00000000-0000-0000-0000-00000000d002' $$,
  'anon cannot see the draft place'
);
select throws_ok(
  $$ insert into public.regions (country, slug, name_i18n) values ('AU', 'rls-anon', '{"en":"x"}') $$,
  '42501', null, 'anon cannot insert into regions'
);
select results_eq($$ select count(*)::int from public.fx_rates $$, array[0], 'anon sees zero fx_rates rows');
select results_eq($$ select count(*)::int from public.regions $$, array[3], 'anon can read reference table regions');
select is(public.is_editor(), false, 'is_editor() callable by anon and false');
select results_eq(
  $$ select count(*)::int from public.place_hours where place_id = '00000000-0000-0000-0000-00000000d001' $$,
  array[1], 'anon sees place_hours of a published place'
);
select is_empty(
  $$ select 1 from public.place_hours where place_id = '00000000-0000-0000-0000-00000000d002' $$,
  'anon cannot see place_hours of a draft place'
);
select results_eq(
  $$ select count(*)::int from public.collection_items where collection_id = '00000000-0000-0000-0000-00000000c701' $$,
  array[1], 'anon sees collection_items of a published collection'
);
select is_empty(
  $$ select 1 from public.collection_items where collection_id = '00000000-0000-0000-0000-00000000c702' $$,
  'anon cannot see collection_items of a draft collection'
);
select results_eq(
  $$ select count(*)::int from public.dish_venues where dish_id = '00000000-0000-0000-0000-00000000a701' $$,
  array[1], 'anon sees dish_venues of a published dish at a published place'
);
select is_empty(
  $$ select 1 from public.dish_venues where dish_id = '00000000-0000-0000-0000-00000000a702' $$,
  'anon cannot see dish_venues of a draft dish'
);
select is_empty($$ select 1 from public.profiles $$, 'anon sees no profiles');
reset role;

-- User A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004a1","role":"authenticated"}';
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004a1' $$,
  '42501', null, 'user cannot set own role'
);
select lives_ok(
  $$ update public.profiles set locale = 'en' where id = '00000000-0000-0000-0000-0000000004a1' $$,
  'user can update own locale'
);
select results_eq(
  $$ select locale, role::text from public.profiles $$,
  $$ values ('en'::text, 'user'::text) $$,
  'user sees only own profile, locale updated, role still user'
);
update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-0000000004b1';
select is(public.is_editor(), false, 'is_editor() false for plain user');
select is_empty(
  $$ select 1 from public.trips where id = '00000000-0000-0000-0000-00000000e0b1' $$,
  'user A cannot see user B trip'
);
select throws_ok(
  $$ insert into public.trips (user_id, title) values ('00000000-0000-0000-0000-0000000004b1', 'spoof') $$,
  '42501', null, 'user A cannot insert a trip for user B'
);
select lives_ok(
  $$ insert into public.trips (id, user_id, title) values ('00000000-0000-0000-0000-00000000e0a1', '00000000-0000-0000-0000-0000000004a1', 'A trip') $$,
  'user A can insert own trip'
);
select throws_ok(
  $$ insert into public.trip_budget_items (trip_id, category, amount, currency) values ('00000000-0000-0000-0000-00000000e0b1', 'food', 10, 'AUD') $$,
  '42501', null, 'user A cannot insert budget item into user B trip'
);
select lives_ok(
  $$ insert into public.trip_checklist_items (trip_id, category, title) values ('00000000-0000-0000-0000-00000000e0a1', 'documents', 'Passport') $$,
  'user A can insert checklist item into own trip'
);
select throws_ok(
  $$ insert into public.saved_items (user_id, entity_type, entity_id, trip_id) values ('00000000-0000-0000-0000-0000000004a1', 'place', '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000e0b1') $$,
  '42501', null, 'user A cannot attach a saved item to user B trip'
);
select throws_ok(
  $$ insert into public.places (city_id, slug, type, name_i18n, geom) values ((select id from public.cities where slug = 'sydney'), 'rls-user', 'cafe', '{"en":"U"}', 'SRID=4326;POINT(151.2 -33.8)') $$,
  '42501', null, 'plain user cannot insert into places'
);
select results_eq($$ select count(*)::int from public.audit_log $$, array[0], 'plain user sees no audit_log rows');
reset role;

select results_eq(
  $$ select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000004b1' $$,
  $$ values (null::text) $$,
  'user A update of user B profile affected nothing'
);

-- Editor
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004e1","role":"authenticated"}';
select is(public.is_editor(), true, 'is_editor() true for editor');
select lives_ok(
  $$ insert into public.places (city_id, slug, type, name_i18n, geom) values ((select id from public.cities where slug = 'sydney'), 'rls-editor', 'cafe', '{"en":"E"}', 'SRID=4326;POINT(151.2 -33.8)') $$,
  'editor can insert into places'
);
select results_eq(
  $$ select count(*)::int from public.places where id in ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-00000000d002') $$,
  array[2], 'editor sees draft and published places'
);
reset role;

select * from finish();
rollback;

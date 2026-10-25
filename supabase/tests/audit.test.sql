begin;
create extension if not exists pgtap;
select plan(19);

-- Triggers present on every status table
select has_trigger('public'::name, 'cities'::name,              'cities_audit'::name);
select has_trigger('public'::name, 'places'::name,              'places_audit'::name);
select has_trigger('public'::name, 'collections'::name,         'collections_audit'::name);
select has_trigger('public'::name, 'dishes'::name,              'dishes_audit'::name);
select has_trigger('public'::name, 'visa_guide_sections'::name, 'visa_guide_sections_audit'::name);
select has_trigger('public'::name, 'places'::name,              'places_touch_updated'::name);
select has_trigger('public'::name, 'dishes'::name,              'dishes_touch_updated'::name);
select has_trigger('public'::name, 'collections'::name,         'collections_touch_updated'::name);

-- Fixtures (as the connecting role)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005e1', 'audit-editor@example.com');
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-0000000005e1';

insert into public.places (id, city_id, slug, type, name_i18n, geom, status, updated_at) values
  ('00000000-0000-0000-0000-00000000f001', (select id from public.cities where slug = 'sydney'), 'audit-place', 'cafe',
   '{"en":"Old"}', 'SRID=4326;POINT(151.2 -33.8)', 'published', '2000-01-01Z');
insert into public.collections (id, slug, kind, title_i18n, status, updated_at) values
  ('00000000-0000-0000-0000-00000000f002', 'audit-collection', 'place', '{"en":"C"}', 'draft', '2000-01-01Z');

-- Act as editor
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005e1","role":"authenticated"}';
update public.places set name_i18n = '{"en":"New"}' where id = '00000000-0000-0000-0000-00000000f001';
update public.collections set title_i18n = '{"en":"C2"}' where id = '00000000-0000-0000-0000-00000000f002';
delete from public.collections where id = '00000000-0000-0000-0000-00000000f002';
reset role;

select results_eq(
  $$ select table_name, action, actor from public.audit_log
     where row_id = '00000000-0000-0000-0000-00000000f001' and action = 'UPDATE' $$,
  $$ values ('places'::text, 'UPDATE'::text, '00000000-0000-0000-0000-0000000005e1'::uuid) $$,
  'one UPDATE audit row for the place, actor = editor'
);
select is(
  (select diff->'name_i18n'->>'en' from public.audit_log
   where row_id = '00000000-0000-0000-0000-00000000f001' and action = 'UPDATE'),
  'New', 'audit diff holds the new row'
);
select results_eq(
  $$ select updated_by, updated_at = now() from public.places where id = '00000000-0000-0000-0000-00000000f001' $$,
  $$ values ('00000000-0000-0000-0000-0000000005e1'::uuid, true) $$,
  'place updated_by = editor and updated_at touched'
);
select results_eq(
  $$ select count(*)::int from public.audit_log
     where row_id = '00000000-0000-0000-0000-00000000f001' and action = 'INSERT' and actor is null $$,
  array[1], 'INSERT by service/owner role audited with null actor'
);
select results_eq(
  $$ select table_name, action, actor, diff->>'slug' from public.audit_log
     where row_id = '00000000-0000-0000-0000-00000000f002' and action = 'DELETE' $$,
  $$ values ('collections'::text, 'DELETE'::text, '00000000-0000-0000-0000-0000000005e1'::uuid, 'audit-collection'::text) $$,
  'DELETE audited with old row as diff'
);
select results_eq(
  $$ select count(*)::int from public.audit_log
     where row_id = '00000000-0000-0000-0000-00000000f002' and action = 'UPDATE' $$,
  array[1], 'collection UPDATE audited'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.audit_content()'::regprocedure),
  true, 'audit_content is security definer'
);
select ok(
  not has_function_privilege('authenticated', 'public.audit_content()', 'execute')
  and not has_function_privilege('anon', 'public.audit_content()', 'execute'),
  'audit_content not executable by anon/authenticated'
);

-- Account deletion (spec §9): deleting an auth user who is an audit actor succeeds
-- and nulls the actor instead of blocking on the FK.
set local request.jwt.claims = '';
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-0000000005e1' $$,
  'deleting an auth user who is an audit actor succeeds'
);
select results_eq(
  $$ select count(*)::int from public.audit_log where actor = '00000000-0000-0000-0000-0000000005e1' $$,
  array[0], 'no audit rows reference the deleted user'
);
select results_eq(
  $$ select actor is null from public.audit_log
     where row_id = '00000000-0000-0000-0000-00000000f001' and action = 'UPDATE'
     order by id limit 1 $$,
  array[true], 'editor UPDATE audit row kept with actor nulled'
);

select * from finish();
rollback;

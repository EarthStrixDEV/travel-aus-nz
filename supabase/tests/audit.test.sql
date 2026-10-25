begin;
create extension if not exists pgtap;
select plan(28);

-- Audit triggers on every content table
select has_trigger('public'::name, t::name, (t || '_audit')::name)
from unnest(array[
  'regions','cities','places','collections','gallery_photos','journeys','scenic_routes',
  'dishes','permission_types','entry_rules','content_blocks'
]) as t;
-- updated_at maintenance where the spec has an updated_at column
select has_trigger('public'::name, 'places'::name,         'places_touch_updated'::name);
select has_trigger('public'::name, 'content_blocks'::name, 'content_blocks_touch_updated'::name);

-- Fixtures (as the connecting role)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000005e1', 'audit-editor@example.com');
update public.profiles set role = 'editor' where id = '00000000-0000-0000-0000-0000000005e1';

insert into public.places (id, city_id, slug, type, name_i18n, geom, status, updated_at) values
  ('00000000-0000-0000-0000-00000000f001', (select id from public.cities where slug = 'sydney'), 'audit-place', 'cafe',
   '{"en":"Old"}', 'SRID=4326;POINT(151.2 -33.8)', 'published', '2000-01-01Z');
insert into public.collections (id, slug, kind, title_i18n, status) values
  ('00000000-0000-0000-0000-00000000f002', 'audit-collection', 'place', '{"en":"C"}', 'draft');
insert into public.content_blocks (key, body_i18n, updated_at) values
  ('audit-block', '{"en":"old"}', '2000-01-01Z');
insert into public.permission_types (id, country, slug, name_i18n) values
  (9401, 'AU', 'audit-permission', '{"en":"P"}');

-- Act as editor
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005e1","role":"authenticated"}';
update public.places set name_i18n = '{"en":"New"}' where id = '00000000-0000-0000-0000-00000000f001';
update public.collections set title_i18n = '{"en":"C2"}' where id = '00000000-0000-0000-0000-00000000f002';
delete from public.collections where id = '00000000-0000-0000-0000-00000000f002';
update public.content_blocks set body_i18n = '{"en":"new"}' where key = 'audit-block';
insert into public.entry_rules (nationality, country, purpose, stay, permission_id)
values ('ZZ', 'AU', 'tourism', 'lt1', 9401);
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
  $$ select updated_at = now() from public.content_blocks where key = 'audit-block' $$,
  array[true], 'content_blocks updated_at touched'
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
select results_eq(
  $$ select table_name, action from public.audit_log where row_id = 'audit-block' and action = 'UPDATE' $$,
  $$ values ('content_blocks'::text, 'UPDATE'::text) $$,
  'content_blocks audited by key'
);
select results_eq(
  $$ select table_name, actor from public.audit_log where row_id = 'ZZ:AU:tourism:lt1' and action = 'INSERT' $$,
  $$ values ('entry_rules'::text, '00000000-0000-0000-0000-0000000005e1'::uuid) $$,
  'entry_rules audited by composite key'
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

-- Account deletion: deleting an auth user who is an audit actor / place editor succeeds
-- and nulls the reference instead of blocking on the FK.
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
select results_eq(
  $$ select updated_by is null from public.places where id = '00000000-0000-0000-0000-00000000f001' $$,
  array[true], 'places.updated_by nulled on account deletion'
);

select * from finish();
rollback;

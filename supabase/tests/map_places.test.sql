begin;
create extension if not exists pgtap;
select plan(14);

-- Fixtures in an empty patch of outback (no seed rows near 140E 30S):
-- n1 holds two published places + one closed + one draft; n2 holds one published bar.
insert into public.cities (id, region_id, slug, name_i18n, timezone, center, status) values
  (9201, (select id from public.regions where slug = 'sydney'), 'mp-test-city', '{"en":"Map Test"}',
   'Australia/Sydney', 'SRID=4326;POINT(140.05 -30.05)', 'published');
insert into public.neighbourhoods (id, city_id, name) values
  (9201, 9201, 'MP North'),
  (9202, 9201, 'MP South');

insert into public.places (id, city_id, neighbourhood_id, slug, type, name_i18n, geom, status, is_closed) values
  ('00000000-0000-0000-0000-0000000f0001', 9201, 9201, 'mp-a', 'attraction', '{"en":"A"}', 'SRID=4326;POINT(140.00 -30.00)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0002', 9201, 9201, 'mp-b', 'restaurant', '{"en":"B"}', 'SRID=4326;POINT(140.02 -30.02)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0003', 9201, 9202, 'mp-c', 'bar',        '{"en":"C"}', 'SRID=4326;POINT(140.08 -30.08)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0004', 9201, 9201, 'mp-closed', 'bar',   '{"en":"X"}', 'SRID=4326;POINT(140.01 -30.01)', 'published', true),
  ('00000000-0000-0000-0000-0000000f0005', 9201, 9201, 'mp-draft', 'cafe',   '{"en":"D"}', 'SRID=4326;POINT(140.01 -30.01)', 'draft',     false);

select has_function('public'::name, 'map_places'::name,
  array['double precision','double precision','double precision','double precision','integer','place_type[]']);
select is(
  (select prosecdef from pg_proc where oid = 'public.map_places(float8,float8,float8,float8,int,public.place_type[])'::regprocedure),
  false, 'map_places is security invoker'
);

-- zoom < 13: clusters by neighbourhood
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters'),
  2, 'zoom 12: two clusters (one per neighbourhood)'
);
select is(
  (select sum(value::int) from jsonb_each_text(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'counts')),
  3::bigint, 'zoom 12: counts sum to 3 (closed and draft excluded)'
);
select results_eq(
  $$ select c->>'neighbourhood', (c->>'count')::int, round((c->>'lng')::numeric, 4), round((c->>'lat')::numeric, 4)
     from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters') c
     order by 1 $$,
  $$ values ('MP North'::text, 2, 140.0100::numeric, -30.0100::numeric), ('MP South', 1, 140.0800, -30.0800) $$,
  'zoom 12: cluster name, count and centroid of member points'
);
select is(
  public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'counts',
  '{"attraction":1,"restaurant":1,"bar":1}'::jsonb, 'counts per type'
);

-- zoom >= 13: GeoJSON features
select is(
  public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #>> '{features,type}',
  'FeatureCollection', 'zoom 14: features is a FeatureCollection'
);
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}'),
  3, 'zoom 14: three features'
);
select results_eq(
  $$ select f #>> '{properties,slug}', f #>> '{properties,type}', f #>> '{properties,name_i18n,en}', f #>> '{geometry,type}'
     from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}') f
     order by 1 $$,
  $$ values ('mp-a'::text, 'attraction'::text, 'A'::text, 'Point'::text), ('mp-b', 'restaurant', 'B', 'Point'), ('mp-c', 'bar', 'C', 'Point') $$,
  'zoom 14: feature props slug, type, name_i18n and point geometry'
);
select is_empty(
  $$ select 1 from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}') f
     where f #>> '{properties,slug}' in ('mp-closed','mp-draft') $$,
  'closed and draft places are absent'
);

-- type filter and bbox
select is(
  public.map_places(139.9, -30.2, 140.2, -29.9, 14, array['bar']::public.place_type[]) -> 'counts',
  '{"bar":1}'::jsonb, 'p_types filter applies to counts'
);
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 14, array['bar','attraction']::public.place_type[]) #> '{features,features}'),
  2, 'p_types filter applies to features'
);
select is(
  jsonb_array_length(public.map_places(139.99, -30.03, 140.03, -29.99, 14, null) #> '{features,features}'),
  2, 'bbox excludes points outside it'
);

-- anon: RLS applies through security invoker
set local role anon;
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}'),
  3, 'anon can call map_places'
);
reset role;

select * from finish();
rollback;

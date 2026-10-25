begin;
create extension if not exists pgtap;
select plan(19);

-- Fixtures in an empty patch of outback (no seed rows near 140E 30S):
-- city 9201: n1 holds two published places + one closed + one draft; n2 holds one published bar;
--            mp-d has no neighbourhood. city 9202: mp-e has no neighbourhood.
insert into public.cities (id, region_id, slug, name_i18n, timezone, center, status) values
  (9201, (select id from public.regions where slug = 'sydney'), 'mp-test-city', '{"en":"Map Test"}',
   'Australia/Sydney', 'SRID=4326;POINT(140.05 -30.05)', 'published'),
  (9202, (select id from public.regions where slug = 'sydney'), 'mp-test-city-2', '{"en":"Map Test Two"}',
   'Australia/Sydney', 'SRID=4326;POINT(140.18 -29.95)', 'published');
insert into public.neighbourhoods (id, city_id, name) values
  (9201, 9201, 'MP North'),
  (9202, 9201, 'MP South');

insert into public.places (id, city_id, neighbourhood_id, slug, type, name_i18n, geom, status, is_closed) values
  ('00000000-0000-0000-0000-0000000f0001', 9201, 9201, 'mp-a', 'attraction', '{"en":"A"}', 'SRID=4326;POINT(140.00 -30.00)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0002', 9201, 9201, 'mp-b', 'restaurant', '{"en":"B"}', 'SRID=4326;POINT(140.02 -30.02)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0003', 9201, 9202, 'mp-c', 'bar',        '{"en":"C"}', 'SRID=4326;POINT(140.08 -30.08)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0004', 9201, 9201, 'mp-closed', 'bar',   '{"en":"X"}', 'SRID=4326;POINT(140.01 -30.01)', 'published', true),
  ('00000000-0000-0000-0000-0000000f0005', 9201, 9201, 'mp-draft', 'cafe',   '{"en":"D"}', 'SRID=4326;POINT(140.01 -30.01)', 'draft',     false),
  ('00000000-0000-0000-0000-0000000f0006', 9201, null, 'mp-d', 'attraction', '{"en":"Dee"}', 'SRID=4326;POINT(140.15 -30.15)', 'published', false),
  ('00000000-0000-0000-0000-0000000f0007', 9202, null, 'mp-e', 'cafe',       '{"en":"E"}', 'SRID=4326;POINT(140.18 -29.95)', 'published', false);

select has_function('public'::name, 'map_places'::name,
  array['double precision','double precision','double precision','double precision','integer','place_type[]']);
select is(
  (select prosecdef from pg_proc where oid = 'public.map_places(float8,float8,float8,float8,int,public.place_type[])'::regprocedure),
  false, 'map_places is security invoker'
);

-- R6: planar viewport filter is index-backed
select has_index('public'::name, 'places'::name, 'places_geom_geometry_gix'::name, 'geometry expression index on places.geom');
create function pg_temp.plan_text(q text) returns text language plpgsql as $f$
declare r text; acc text := '';
begin
  for r in execute 'explain ' || q loop acc := acc || r || E'\n'; end loop;
  return acc;
end $f$;
set local enable_seqscan = off;
select matches(
  pg_temp.plan_text($q$ select 1 from public.places p
    where extensions.st_intersects(p.geom::extensions.geometry,
                                   extensions.st_makeenvelope(139.9, -30.2, 140.2, -29.9, 4326)) $q$),
  'places_geom_geometry_gix', 'viewport predicate uses the geometry index'
);
reset enable_seqscan;

-- zoom < 13: clusters by (city, neighbourhood); no-neighbourhood places form a per-city cluster
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters'),
  4, 'zoom 12: four clusters (two neighbourhoods + one city-level cluster per city)'
);
select is(
  (select sum(value::int) from jsonb_each_text(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'counts')),
  5::bigint, 'zoom 12: counts sum to 5 (closed and draft excluded)'
);
select results_eq(
  $$ select c->>'city', c->>'neighbourhood', (c->>'neighbourhood_id')::int, (c->>'count')::int,
            round((c->>'lng')::numeric, 4), round((c->>'lat')::numeric, 4)
     from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters') c
     order by 1, 2 nulls first $$,
  $$ values ('mp-test-city'::text, null::text, null::int, 1, 140.1500::numeric, -30.1500::numeric),
            ('mp-test-city', 'MP North', 9201, 2, 140.0100, -30.0100),
            ('mp-test-city', 'MP South', 9202, 1, 140.0800, -30.0800),
            ('mp-test-city-2', null, null, 1, 140.1800, -29.9500) $$,
  'zoom 12: cluster city, neighbourhood, id, count and centroid of member points'
);
select is_empty(
  $$ select 1 from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters') c
     where c->>'city' is null $$,
  'zoom 12: no cluster without a city (never one cross-city null cluster)'
);
select is(
  (select c->'city_name' from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'clusters') c
   where c->>'city' = 'mp-test-city-2'),
  '{"en":"Map Test Two"}'::jsonb, 'zoom 12: cluster carries the city name_i18n'
);
select is(
  public.map_places(139.9, -30.2, 140.2, -29.9, 12, null) -> 'counts',
  '{"attraction":2,"restaurant":1,"bar":1,"cafe":1}'::jsonb, 'counts per type'
);

-- zoom >= 13: GeoJSON features
select is(
  public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #>> '{features,type}',
  'FeatureCollection', 'zoom 14: features is a FeatureCollection'
);
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}'),
  5, 'zoom 14: five features'
);
select results_eq(
  $$ select f #>> '{properties,slug}', f #>> '{properties,type}', f #>> '{properties,name_i18n,en}', f #>> '{geometry,type}'
     from jsonb_array_elements(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}') f
     order by 1 $$,
  $$ values ('mp-a'::text, 'attraction'::text, 'A'::text, 'Point'::text), ('mp-b', 'restaurant', 'B', 'Point'),
            ('mp-c', 'bar', 'C', 'Point'), ('mp-d', 'attraction', 'Dee', 'Point'), ('mp-e', 'cafe', 'E', 'Point') $$,
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
  3, 'p_types filter applies to features'
);
select is(
  jsonb_array_length(public.map_places(139.99, -30.03, 140.03, -29.99, 14, null) #> '{features,features}'),
  2, 'bbox excludes points outside it'
);
select is(
  jsonb_array_length(public.map_places(140.00, -30.00, 140.02, -29.99, 14, null) #> '{features,features}'),
  1, 'bbox edge is inclusive and exact (point on the min corner)'
);

-- anon: RLS applies through security invoker
set local role anon;
select is(
  jsonb_array_length(public.map_places(139.9, -30.2, 140.2, -29.9, 14, null) #> '{features,features}'),
  5, 'anon can call map_places'
);
reset role;

select * from finish();
rollback;

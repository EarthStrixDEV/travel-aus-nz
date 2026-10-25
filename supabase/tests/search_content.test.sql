begin;
create extension if not exists pgtap;
select plan(14);

-- Fixtures: everything is named "Zephyrine" so seed rows never match.
-- srch-a has best_months {3,4}; srch-b has none (kept by any month filter).
insert into public.regions (id, country, slug, name_i18n, state_i18n, best_months, status) values
  (9301, 'AU', 'srch-a',     '{"en":"Zephyrine Coast","th":"ชายฝั่งซีเฟอรีน"}', '{"en":"Test state"}', '{3,4}', 'published'),
  (9302, 'AU', 'srch-b',     '{"en":"Zephyrine Plains"}',                          null,                  null,    'published'),
  (9303, 'AU', 'srch-draft', '{"en":"Zephyrine Draft"}',                           null,                  '{3}',   'draft');
insert into public.cities (id, region_id, slug, name_i18n, timezone, center, status) values
  (9301, 9301, 'srch-city-a', '{"en":"Search City A"}', 'Australia/Sydney',   'SRID=4326;POINT(141.0 -31.0)', 'published'),
  (9302, 9302, 'srch-city-b', '{"en":"Search City B"}', 'Australia/Adelaide', 'SRID=4326;POINT(141.5 -31.5)', 'published');
insert into public.places (city_id, slug, type, name_i18n, area_i18n, geom, status, is_closed) values
  (9301, 'zp-cove',   'attraction', '{"en":"Zephyrine Cove","th":"อ่าวซีเฟอรีน"}', '{"en":"North shore"}', 'SRID=4326;POINT(141.0 -31.0)', 'published', false),
  (9301, 'zp-closed', 'bar',        '{"en":"Zephyrine Closed"}',                     null,                  'SRID=4326;POINT(141.0 -31.1)', 'published', true),
  (9301, 'zp-draft',  'cafe',       '{"en":"Zephyrine Draftplace"}',                 null,                  'SRID=4326;POINT(141.0 -31.2)', 'draft',     false),
  (9302, 'zp-plains-bar', 'bar',    '{"en":"Zephyrine Plains Bar"}',                 null,                  'SRID=4326;POINT(141.5 -31.5)', 'published', false);
insert into public.tags (slug, kind, name_i18n) values ('srch-tag', 'interest', '{"en":"Search tag"}');
insert into public.place_tags (place_id, tag_id)
  select p.id, t.id from public.places p, public.tags t where p.slug = 'zp-cove' and t.slug = 'srch-tag';
insert into public.journeys (slug, kind, title_i18n, from_name, to_name, status) values
  ('zp-trail',          'itinerary',      '{"en":"Zephyrine Trail"}',    'Alpha', 'Beta', 'published'),
  ('zp-showcase',       'route_showcase', '{"en":"Zephyrine Showcase"}', 'Alpha', 'Beta', 'published'),
  ('zp-journey-draft',  'itinerary',      '{"en":"Zephyrine Hidden"}',   'Alpha', 'Beta', 'draft');

select has_function('public'::name, 'search_content'::name,
  array['text','text','text','integer','text[]']);
select is(
  (select prosecdef from pg_proc where oid = 'public.search_content(text,text,text,int,text[])'::regprocedure),
  false, 'search_content is security invoker'
);

select is(
  (select array_agg(kind || ':' || slug order by kind, slug) from public.search_content('zephyrine', 'en')),
  array['journey:zp-trail','place:zp-cove','place:zp-plains-bar','region:srch-a','region:srch-b'],
  'published places, regions and itineraries; closed, draft and route_showcase excluded'
);
select is(
  (select array_agg(kind || ':' || slug order by kind, slug) from public.search_content('ซีเฟอรีน', 'th')),
  array['place:zp-cove','region:srch-a'],
  'th locale matches the Thai names'
);
select is(
  (select sub from public.search_content('zephyrine cove', 'en') where slug = 'zp-cove'),
  'North shore', 'place sub is the area'
);
select is(
  (select sub from public.search_content('zephyrine trail', 'en') where slug = 'zp-trail'),
  'Alpha → Beta', 'journey sub is from → to'
);
select is(
  (select count(*) from public.search_content('zephyrin cov', 'en') where slug = 'zp-cove'),
  1::bigint, 'tolerates typos and partial words'
);

select is(
  (select array_agg(kind || ':' || slug order by kind, slug) from public.search_content('zephyrine', 'en', 'srch-a')),
  array['place:zp-cove','region:srch-a'],
  'region filter keeps that region and its places, drops journeys'
);
select is(
  (select array_agg(kind || ':' || slug order by kind, slug) from public.search_content('zephyrine', 'en', null, 3)),
  array['journey:zp-trail','place:zp-cove','place:zp-plains-bar','region:srch-a','region:srch-b'],
  'month 3 is in srch-a best_months; srch-b has none and stays'
);
select is(
  (select array_agg(kind || ':' || slug order by kind, slug) from public.search_content('zephyrine', 'en', null, 7)),
  array['journey:zp-trail','place:zp-plains-bar','region:srch-b'],
  'month 7 drops srch-a and its places'
);
select is(
  (select array_agg(kind || ':' || slug order by kind, slug)
   from public.search_content('zephyrine', 'en', null, null, array['srch-tag'])),
  array['place:zp-cove'],
  'interests filter keeps tagged places only'
);
select is_empty(
  $$ select 1 from public.search_content('%%', 'en') $$,
  'LIKE wildcards in q are escaped'
);
select is(
  (select slug from public.search_content('zephyrine trail', 'en') limit 1),
  'zp-trail', 'exact match ranks first'
);

set local role anon;
select is(
  (select count(*) from public.search_content('zephyrine', 'en')),
  5::bigint, 'anon can call search_content'
);
reset role;

select * from finish();
rollback;

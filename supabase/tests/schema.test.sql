begin;
create extension if not exists pgtap;
select plan(79);

-- §14: exactly these 59 tables in public
select tables_are('public'::name, array[
  -- 14.1 core & content
  'profiles','regions','cities','neighbourhoods','tags','media_assets','content_blocks','faqs',
  'hero_slides','newsletter_subscribers','audit_log',
  -- 14.2 places, venues, gallery
  'places','place_hours','place_tags','place_stop_links','place_nearby_venues','cuisines','venues',
  'venue_drinks','gallery_photos','collections','collection_items',
  -- 14.3 transit & routing
  'transit_agencies','transit_stops','transit_lines','line_stops','line_service_summary','transit_cards',
  'fare_rules','scenic_routes','airport_transfers','journeys','journey_legs',
  -- 14.4 dishes
  'dishes','dish_pairings','dish_venues',
  -- 14.5 fx
  'currencies','fx_snapshots','fx_daily','cost_reference_items','budget_presets',
  -- 14.6 entry
  'permission_types','entry_rules','official_links','link_checks','entry_documents','content_feedback',
  -- 14.7 prepare
  'checklist_templates','packing_items','region_months','connectivity_options',
  -- 14.8 trip & user data
  'trips','trip_days','trip_stops','trip_legs','saved_items','trip_checklist_items','trip_packing_items','trip_shares'
]::name[], 'public has exactly the 59 tables of spec §14');

select has_table('public'::name, t::name)
from unnest(array[
  'profiles','regions','cities','neighbourhoods','tags','media_assets','content_blocks','faqs',
  'hero_slides','newsletter_subscribers','audit_log',
  'places','place_hours','place_tags','place_stop_links','place_nearby_venues','cuisines','venues',
  'venue_drinks','gallery_photos','collections','collection_items',
  'transit_agencies','transit_stops','transit_lines','line_stops','line_service_summary','transit_cards',
  'fare_rules','scenic_routes','airport_transfers','journeys','journey_legs',
  'dishes','dish_pairings','dish_venues',
  'currencies','fx_snapshots','fx_daily','cost_reference_items','budget_presets',
  'permission_types','entry_rules','official_links','link_checks','entry_documents','content_feedback',
  'checklist_templates','packing_items','region_months','connectivity_options',
  'trips','trip_days','trip_stops','trip_legs','saved_items','trip_checklist_items','trip_packing_items','trip_shares'
]) as t;

select col_type_is('public'::name, 'places'::name, 'geom'::name, 'geography(Point,4326)', 'places.geom is geography(Point,4326)');
select col_type_is('public'::name, 'cities'::name, 'bbox'::name, 'geography(Polygon,4326)', 'cities.bbox is geography(Polygon,4326)');

select enum_has_labels('public'::name, 'place_type'::name,
  array['attraction','restaurant','bar','cafe','station','village'], 'place_type labels');
select enum_has_labels('public'::name, 'transit_mode'::name,
  array['train','metro','tram','bus','coach','ferry','walk'], 'transit_mode labels');
select enum_has_labels('public'::name, 'season'::name,
  array['summer','autumn','winter','spring'], 'season labels');
select enum_has_labels('public'::name, 'saved_entity'::name,
  array['place','dish','journey'], 'saved_entity labels');

-- Plan deviation 3: FKs the spec DDL leaves implicit
select fk_ok('public', 'regions',          'cover_media_id',   'public', 'media_assets',   'id');
select fk_ok('public', 'hero_slides',      'place_id',         'public', 'places',         'id');
select fk_ok('public', 'scenic_routes',    'cover_media_id',   'public', 'media_assets',   'id');
select fk_ok('public', 'journeys',         'cover_media_id',   'public', 'media_assets',   'id');
select fk_ok('public', 'transit_agencies', 'card_id',          'public', 'transit_cards',  'id');
select fk_ok('public', 'permission_types', 'official_link_id', 'public', 'official_links', 'id');

-- Fixtures: one user (profile auto-created by trigger)
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000b1', 'schema-test@example.com');

select throws_ok(
  $$insert into public.trips (user_id, title, start_date, end_date)
    values ('00000000-0000-0000-0000-0000000000b1', 'bad dates', '2026-11-10', '2026-11-01')$$,
  '23514', null,
  'trips rejects end_date before start_date'
);

select throws_ok(
  $$insert into public.places (city_id, slug, type, name_i18n, geom, price_level)
    values ((select id from public.cities where slug = 'sydney'), 'schema-test-place', 'cafe', '{"en":"x"}',
            'SRID=4326;POINT(151.2 -33.8)', 5)$$,
  '23514', null,
  'places rejects price_level = 5'
);

select lives_ok(
  $$insert into public.places (city_id, slug, type, name_i18n, geom, price_level)
    values ((select id from public.cities where slug = 'sydney'), 'schema-test-free', 'attraction', '{"en":"x"}',
            'SRID=4326;POINT(151.2 -33.8)', 0)$$,
  'places accepts price_level = 0 (free)'
);

select throws_ok(
  $$insert into public.content_feedback (entity, kind, note) values (repeat('x', 121), 'outdated', 'n')$$,
  '23514', null,
  'content_feedback.entity capped at 120 chars'
);

select throws_ok(
  $$insert into public.content_feedback (entity, kind, note) values ('place:x', 'outdated', repeat('x', 1001))$$,
  '23514', null,
  'content_feedback.note capped at 1000 chars'
);

select results_eq(
  $$select code::text from public.currencies order by code$$,
  $$values ('AUD'::text), ('CNY'), ('EUR'), ('GBP'), ('JPY'), ('NZD'), ('SGD'), ('THB'), ('USD')$$,
  'currencies reference data: the nine codes of spec §10'
);

select results_eq(
  $$select key from public.content_blocks where key in ('money_tips','entry_timeline') order by key$$,
  $$values ('entry_timeline'::text), ('money_tips')$$,
  'content_blocks reference keys present'
);

select * from finish();
rollback;

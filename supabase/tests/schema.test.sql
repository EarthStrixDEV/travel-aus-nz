begin;
create extension if not exists pgtap;
select plan(33);

select has_table('public'::name, 'places'::name);
select has_table('public'::name, 'place_hours'::name);
select has_table('public'::name, 'place_tags'::name);
select has_table('public'::name, 'collections'::name);
select has_table('public'::name, 'collection_items'::name);
select has_table('public'::name, 'transit_agencies'::name);
select has_table('public'::name, 'transit_routes'::name);
select has_table('public'::name, 'transit_stops'::name);
select has_table('public'::name, 'route_stops'::name);
select has_table('public'::name, 'transit_cards'::name);
select has_table('public'::name, 'city_climate'::name);
select has_table('public'::name, 'currencies'::name);
select has_table('public'::name, 'fx_rates'::name);
select has_table('public'::name, 'fx_rates_daily'::name);
select has_table('public'::name, 'cost_reference_items'::name);
select has_table('public'::name, 'fx_alerts'::name);
select has_table('public'::name, 'dish_categories'::name);
select has_table('public'::name, 'dishes'::name);
select has_table('public'::name, 'dish_venues'::name);
select has_table('public'::name, 'official_links'::name);
select has_table('public'::name, 'visa_guide_sections'::name);
select has_table('public'::name, 'section_links'::name);
select has_table('public'::name, 'link_checks'::name);
select has_table('public'::name, 'content_feedback'::name);
select has_table('public'::name, 'trips'::name);
select has_table('public'::name, 'trip_cities'::name);
select has_table('public'::name, 'checklist_templates'::name);
select has_table('public'::name, 'trip_checklist_items'::name);
select has_table('public'::name, 'trip_budget_items'::name);
select has_table('public'::name, 'saved_items'::name);

-- fixtures: one user (profile auto-created by trigger), one city, one place
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000b1', 'schema-test@example.com');

insert into public.cities (id, region_id, slug, name_i18n, timezone, center, status)
values (9001, (select id from public.regions where slug = 'nsw'), 'schema-test-city',
        '{"en":"Schema Test"}', 'Australia/Sydney', 'SRID=4326;POINT(151.2093 -33.8688)', 'published');

select throws_ok(
  $$insert into public.trips (user_id, title, start_date, end_date)
    values ('00000000-0000-0000-0000-0000000000b1', 'bad dates', '2026-11-10', '2026-11-01')$$,
  '23514', null,
  'trips rejects end_date before start_date'
);

select throws_ok(
  $$insert into public.places (city_id, slug, type, name_i18n, geom, price_level)
    values (9001, 'schema-test-place', 'cafe', '{"en":"x"}', 'SRID=4326;POINT(151.2 -33.8)', 5)$$,
  '23514', null,
  'places rejects price_level = 5'
);

select results_eq(
  $$select code::text, symbol from public.currencies order by code$$,
  $$values ('AUD'::text, 'A$'::text), ('NZD', 'NZ$'), ('THB', '฿'), ('USD', '$')$$,
  'currencies seeded with THB, AUD, NZD, USD'
);

select * from finish();
rollback;

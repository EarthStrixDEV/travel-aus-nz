-- Map viewport query v2 (spec §5; controller ruling R6). Same signature and contract as v1
-- (security invoker; published + not closed; zoom < 13 clusters / >= 13 <= 500 features;
-- counts per type over every match), with two changes:
--   1. The planar bbox test is backed by an expression index on geom::geometry, so the
--      viewport filter uses an index while keeping exact edges.
--   2. Clusters group by (city_id, neighbourhood_id). Places without a neighbourhood form
--      one city-level cluster per city (never a single cross-city null cluster).
--      Cluster: { neighbourhood_id, neighbourhood, city, city_name, lng, lat, count }
--      (neighbourhood_id / neighbourhood are null for a city-level cluster).
create index if not exists places_geom_geometry_gix
  on public.places using gist ((geom::extensions.geometry));

create or replace function public.map_places(
  min_lng float8, min_lat float8, max_lng float8, max_lat float8,
  p_zoom int, p_types public.place_type[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with pts as (
    select p.slug, p.type, p.name_i18n, p.city_id, p.neighbourhood_id, p.geom::extensions.geometry as g
    from public.places p
    where p.status = 'published'
      and not p.is_closed
      and (p_types is null or p.type = any (p_types))
      and extensions.st_intersects(
            p.geom::extensions.geometry,
            extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326))
  ),
  counts as (
    select coalesce(jsonb_object_agg(type::text, n), '{}'::jsonb) as c
    from (select type, count(*) as n from pts group by type) s
  )
  select case
    when p_zoom < 13 then jsonb_build_object(
      'clusters', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'neighbourhood_id', k.neighbourhood_id,
                 'neighbourhood', nb.name,
                 'city', c.slug,
                 'city_name', c.name_i18n,
                 'lng', extensions.st_x(k.centroid),
                 'lat', extensions.st_y(k.centroid),
                 'count', k.n
               ) order by k.n desc, c.slug, nb.name nulls first), '[]'::jsonb)
        from (
          select city_id, neighbourhood_id, count(*) as n,
                 extensions.st_centroid(extensions.st_collect(g)) as centroid
          from pts group by city_id, neighbourhood_id
        ) k
        left join public.cities c on c.id = k.city_id
        left join public.neighbourhoods nb on nb.id = k.neighbourhood_id
      ),
      'counts', (select c from counts))
    else jsonb_build_object(
      'features', jsonb_build_object(
        'type', 'FeatureCollection',
        'features', (
          select coalesce(jsonb_agg(f.feature order by f.slug), '[]'::jsonb)
          from (
            select slug, jsonb_build_object(
                     'type', 'Feature',
                     'geometry', extensions.st_asgeojson(g)::jsonb,
                     'properties', jsonb_build_object('slug', slug, 'type', type, 'name_i18n', name_i18n)
                   ) as feature
            from pts order by slug limit 500
          ) f
        )
      ),
      'counts', (select c from counts))
  end;
$$;

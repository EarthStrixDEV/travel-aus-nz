-- Map viewport query (spec §5, used by GET /api/v1/map/places).
-- Security invoker: the caller's RLS applies; published + not closed only.
--   p_zoom < 13  -> { clusters: [{ neighbourhood, lng, lat, count }], counts: { type: n } }
--                   grouped by neighbourhood_id, centroid of member points
--   p_zoom >= 13 -> { features: GeoJSON FeatureCollection (<= 500), counts: { type: n } }
-- p_types null = all types. counts always cover every matching place (not capped at 500).
-- The bbox test is planar (geometry), so viewport edges are exact at any zoom.
create function public.map_places(
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
    select p.slug, p.type, p.name_i18n, p.neighbourhood_id, p.geom::extensions.geometry as g
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
                 'neighbourhood', nb.name,
                 'lng', extensions.st_x(k.centroid),
                 'lat', extensions.st_y(k.centroid),
                 'count', k.n
               ) order by k.n desc, nb.name), '[]'::jsonb)
        from (
          select neighbourhood_id, count(*) as n,
                 extensions.st_centroid(extensions.st_collect(g)) as centroid
          from pts group by neighbourhood_id
        ) k
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

grant execute on function public.map_places(float8, float8, float8, float8, int, public.place_type[])
  to anon, authenticated, service_role;

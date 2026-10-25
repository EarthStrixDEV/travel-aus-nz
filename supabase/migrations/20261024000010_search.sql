-- Home search (spec §4, used by GET /api/v1/search).
-- Security invoker: the caller's RLS applies; published rows only, closed places excluded.
-- Matches `name_i18n->>p_locale` and the English name by pg_trgm word similarity (typo tolerant)
-- or case-insensitive substring (LIKE wildcards in q are escaped). Best 20, highest score first.
-- Filters:
--   p_region    region slug: places in that region + the region itself (journeys have no region link, so excluded)
--   p_month     1-12: places/regions whose region best_months contains it; regions with no best_months are kept
--   p_interests tag slugs: places carrying any of them (regions and journeys carry no tags, so excluded)
create function public.search_content(
  q text,
  p_locale text,
  p_region text default null,
  p_month int default null,
  p_interests text[] default null
)
returns table (kind text, slug text, name text, sub text)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (
    select btrim(q) as needle,
           '%' || replace(replace(replace(btrim(q), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as pat
  ),
  cand as (
    select 'place'::text as kind, p.slug as slug,
           coalesce(nullif(p.name_i18n->>p_locale, ''), p.name_i18n->>'en', '') as name,
           coalesce(p.name_i18n->>'en', '') as alt,
           coalesce(nullif(p.area_i18n->>p_locale, ''), p.area_i18n->>'en',
                    nullif(c.name_i18n->>p_locale, ''), c.name_i18n->>'en', '') as sub
    from public.places p
    join public.cities c on c.id = p.city_id
    join public.regions r on r.id = c.region_id
    where p.status = 'published'
      and not p.is_closed
      and (p_region is null or r.slug = p_region)
      and (p_month is null or r.best_months is null or p_month = any (r.best_months))
      and (p_interests is null or exists (
            select 1 from public.place_tags pt join public.tags t on t.id = pt.tag_id
            where pt.place_id = p.id and t.slug = any (p_interests)))
    union all
    select 'region'::text, r.slug,
           coalesce(nullif(r.name_i18n->>p_locale, ''), r.name_i18n->>'en', ''),
           coalesce(r.name_i18n->>'en', ''),
           coalesce(nullif(r.state_i18n->>p_locale, ''), r.state_i18n->>'en', '')
    from public.regions r
    where r.status = 'published'
      and (p_region is null or r.slug = p_region)
      and (p_month is null or r.best_months is null or p_month = any (r.best_months))
      and p_interests is null
    union all
    select 'journey'::text, j.slug,
           coalesce(nullif(j.title_i18n->>p_locale, ''), j.title_i18n->>'en', ''),
           coalesce(j.title_i18n->>'en', ''),
           concat_ws(' → ', j.from_name, j.to_name)
    from public.journeys j
    where j.status = 'published'
      and j.kind = 'itinerary'
      and p_region is null
      and p_interests is null
  ),
  scored as (
    select c.kind, c.slug, c.name, c.sub,
           greatest(
             extensions.word_similarity(n.needle, c.name),
             extensions.word_similarity(n.needle, c.alt),
             case when c.name ilike n.pat or c.alt ilike n.pat then 1.0::real else 0.0::real end
           ) as score
    from cand c cross join n
  )
  select s.kind, s.slug, s.name, s.sub
  from scored s
  where s.score >= 0.4 and s.name <> ''
  order by s.score desc, s.name, s.slug
  limit 20;
$$;

grant execute on function public.search_content(text, text, text, int, text[])
  to anon, authenticated, service_role;

-- Spec §14.2 Places, venues, gallery.
-- updated_by: on delete set null so account deletion is not blocked (foundation convention).
create table places (
  id uuid primary key default gen_random_uuid(),
  city_id int not null references cities,
  neighbourhood_id int references neighbourhoods,
  slug text unique not null,
  type place_type not null,
  category text,                            -- Beach, Mountain, Heritage... (gallery type)
  name_i18n jsonb not null, area_i18n jsonb, desc_i18n jsonb,
  best_time_i18n jsonb, access_i18n jsonb,  -- "how to get there" without a car
  geom geography(point,4326) not null,
  price_level smallint check (price_level between 0 and 4),
  price_note_i18n jsonb, hours_note_i18n jsonb,
  website text, is_closed boolean not null default false,
  status content_status not null default 'draft',
  verified_at date, updated_by uuid references profiles on delete set null, updated_at timestamptz default now()
);
create index places_geom_gix on places using gist (geom);
create index places_city_type on places (city_id, type) where status = 'published';

-- Plan deviation 3: hero_slides.place_id -> places.
alter table hero_slides add constraint hero_slides_place_id_fkey
  foreign key (place_id) references places;

create table place_hours (
  place_id uuid references places on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  open_time time not null, close_time time not null,   -- close < open = after midnight
  primary key (place_id, weekday, open_time)
);

create table place_tags (
  place_id uuid references places on delete cascade,
  tag_id int references tags on delete cascade,
  primary key (place_id, tag_id)
);

create table place_stop_links (             -- precomputed nearest stops
  place_id uuid references places on delete cascade,
  stop_id int references transit_stops on delete cascade,
  rank smallint not null,
  walk_min smallint not null, walk_geom geography(linestring,4326),
  primary key (place_id, stop_id)
);

create table place_nearby_venues (
  place_id uuid references places on delete cascade,
  venue_id uuid references places on delete cascade,
  sort smallint default 0,
  primary key (place_id, venue_id)
);

create table cuisines (id serial primary key, slug text unique, name_i18n jsonb);

create table venues (                       -- 1:1 with places of type restaurant/bar/cafe
  place_id uuid primary key references places on delete cascade,
  cuisine_id int references cuisines,
  dietary text[] default '{}',
  menu_highlights_i18n jsonb,
  drinks_i18n jsonb,
  booking text check (booking in ('required','recommended','walk_in'))
);

create table venue_drinks (
  place_id uuid references venues on delete cascade,
  drink text not null,                      -- wine | cocktails | beer | coffee | non_alc
  primary key (place_id, drink)
);

create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_assets,
  place_id uuid not null references places,
  region_id int references regions,
  season season,
  title_i18n jsonb, sort int default 0,
  status content_status not null default 'draft'
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('venue','dish','place')),
  placement text,                           -- home_dining | dishes
  title_i18n jsonb not null, sub_i18n jsonb,
  status content_status not null default 'draft'
);

create table collection_items (
  collection_id uuid references collections on delete cascade,
  entity_id uuid not null, position int not null,
  primary key (collection_id, entity_id)
);

-- Open-now check in the place's city time zone; close < open means "closes after midnight".
create or replace function is_open_now(p_place uuid, p_at timestamptz)
returns boolean language sql stable
set search_path = ''
as $$
  with t as (
    select (p_at at time zone c.timezone) as local
    from public.places p join public.cities c on c.id = p.city_id where p.id = p_place
  )
  select exists (
    select 1 from public.place_hours h, t
    where h.place_id = p_place and (
      (h.close_time > h.open_time and h.weekday = extract(dow from t.local)
        and t.local::time between h.open_time and h.close_time)
      or (h.close_time < h.open_time and (
        (h.weekday = extract(dow from t.local) and t.local::time >= h.open_time)
        or (h.weekday = (extract(dow from t.local)::int + 6) % 7 and t.local::time < h.close_time)))
    ));
$$;

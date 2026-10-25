create table places (
  id uuid primary key default gen_random_uuid(),
  city_id int not null references cities,
  slug text unique not null,
  type place_type not null,
  name_i18n jsonb not null,
  summary_i18n jsonb,
  body_i18n jsonb,
  address text,
  geom geography(point,4326) not null,
  price_level smallint check (price_level between 1 and 4),
  website text, phone text,
  cover_media_id uuid references media_assets,
  is_closed boolean not null default false,
  status content_status not null default 'draft',
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
create index places_geom_gix on places using gist (geom);
create index places_city_type_idx on places (city_id, type) where status = 'published';

create table place_hours (
  place_id uuid references places on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,          -- < open_time = closes after midnight
  primary key (place_id, weekday, open_time)
);

create table place_tags (
  place_id uuid references places on delete cascade,
  tag_id int references tags on delete cascade,
  primary key (place_id, tag_id)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('place','dish','mixed')),
  placement text,                    -- 'home' | null
  title_i18n jsonb not null, intro_i18n jsonb,
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft',
  updated_at timestamptz default now()
);

create table collection_items (
  collection_id uuid references collections on delete cascade,
  entity_type saved_entity not null,
  entity_id uuid not null,
  position int not null,
  note_i18n jsonb,
  primary key (collection_id, entity_type, entity_id)
);

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

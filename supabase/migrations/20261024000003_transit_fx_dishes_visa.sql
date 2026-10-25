create table transit_agencies (
  id serial primary key, city_id int references cities,
  name text not null, gtfs_url text, website text
);

create table transit_routes (
  id serial primary key,
  agency_id int not null references transit_agencies,
  gtfs_route_id text, mode transit_mode not null,
  short_name text, long_name_i18n jsonb,
  shape geography(multilinestring,4326),
  unique (agency_id, gtfs_route_id)
);
create index transit_routes_shape_gix on transit_routes using gist (shape);

create table transit_stops (
  id serial primary key,
  agency_id int not null references transit_agencies,
  gtfs_stop_id text, name text not null,
  geom geography(point,4326) not null,
  unique (agency_id, gtfs_stop_id)
);
create index transit_stops_geom_gix on transit_stops using gist (geom);

create table route_stops (
  route_id int references transit_routes on delete cascade,
  stop_id int references transit_stops on delete cascade,
  seq int not null,
  primary key (route_id, stop_id)
);

create table transit_cards (
  id serial primary key,
  city_id int references cities,
  name text not null,                -- Opal, Myki, go card, Snapper, Bee Card
  how_to_i18n jsonb, official_url text,
  verified_at date
);

create table city_climate (
  city_id int references cities,
  month smallint check (month between 1 and 12),
  avg_high_c numeric(4,1), avg_low_c numeric(4,1), rain_days smallint,
  primary key (city_id, month)
);

create table currencies (
  code char(3) primary key, name_i18n jsonb, symbol text, decimals smallint default 2
);

create table fx_rates (
  base char(3) references currencies,
  quote char(3) references currencies,
  rate numeric(18,8) not null,
  source text not null,
  fetched_at timestamptz not null,
  primary key (base, quote, fetched_at)
);

create table fx_rates_daily (
  base char(3), quote char(3), day date,
  open numeric(18,8), high numeric(18,8), low numeric(18,8), close numeric(18,8),
  primary key (base, quote, day)
);

create table cost_reference_items (
  id serial primary key,
  country country_code not null, city_id int references cities,
  label_i18n jsonb not null,
  price_local numeric(10,2) not null, currency char(3) not null,
  verified_at date not null, sort int default 0
);

create table fx_alerts (                 -- phase 2
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  base char(3), quote char(3), threshold numeric(18,8),
  direction text check (direction in ('above','below')),
  last_fired_at timestamptz, active boolean default true
);

create table dish_categories (
  id serial primary key, slug text unique, name_i18n jsonb   -- savory, sweet, drink
);

create table dishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  country country_code not null,
  region_id int references regions,
  category_id int references dish_categories,
  name_i18n jsonb not null,
  story_i18n jsonb, taste_i18n jsonb,
  dietary text[] default '{}',       -- 'vegetarian','vegan','gluten_free','contains_nuts'
  typical_price_local numeric(8,2),
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft',
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz default now()
);

create table dish_venues (
  dish_id uuid references dishes on delete cascade,
  place_id uuid references places on delete cascade,
  rank smallint not null default 1,
  editor_note_i18n jsonb,
  price_local numeric(8,2),
  verified_at date,
  primary key (dish_id, place_id)
);

create table official_links (
  id serial primary key,
  country country_code not null,
  agency text not null,              -- Home Affairs, Immigration NZ, ABF, MPI
  title_i18n jsonb not null, url text not null unique,
  health_status text default 'ok',   -- ok | redirected | broken
  last_checked_at timestamptz, content_hash text
);

create table visa_guide_sections (
  id serial primary key,
  country country_code not null,
  purpose text not null check (purpose in ('tourism','transit','work_study','arrival')),
  title_i18n jsonb not null, body_i18n jsonb not null,
  sort int default 0,
  last_verified_at date not null,
  needs_review boolean not null default false,
  status content_status not null default 'draft'
);

create table section_links (
  section_id int references visa_guide_sections on delete cascade,
  link_id int references official_links on delete cascade,
  primary key (section_id, link_id)
);

create table link_checks (
  id bigserial primary key,
  link_id int references official_links on delete cascade,
  status_code int, final_url text, content_hash text,
  checked_at timestamptz default now()
);

create table content_feedback (
  id bigserial primary key,
  entity_type text not null, entity_id text not null,
  kind text check (kind in ('outdated','broken','unclear')),
  note text, user_id uuid references profiles on delete set null,
  created_at timestamptz default now(), resolved boolean default false
);

-- Spec §14.3 Transit & routing (before §14.2: place_stop_links references transit_stops).
create table transit_agencies (
  id serial primary key, country country_code not null,
  name text not null, gtfs_url text, website text, card_id int
);

create table transit_stops (
  id serial primary key, agency_id int references transit_agencies,
  gtfs_stop_id text, name text not null,
  geom geography(point,4326) not null, step_free boolean,
  unique (agency_id, gtfs_stop_id)
);
create index transit_stops_gix on transit_stops using gist (geom);

create table transit_lines (
  id serial primary key, agency_id int references transit_agencies,
  city_id int references cities,
  gtfs_route_id text, mode transit_mode not null,
  short_name text, long_name text,
  shape geography(multilinestring,4326),
  unique (agency_id, gtfs_route_id)
);

create table line_stops (
  line_id int references transit_lines on delete cascade,
  stop_id int references transit_stops on delete cascade,
  seq int not null, primary key (line_id, seq)
);

create table line_service_summary (         -- for the route explorer
  line_id int primary key references transit_lines on delete cascade,
  end_to_end_min int, headway_peak_min int, headway_offpeak_min int,
  fare_min numeric(6,2), fare_max numeric(6,2), computed_at timestamptz
);

create table transit_cards (
  id serial primary key, city_id int references cities,
  name text not null,                       -- Opal, myki, go card, AT HOP, Snapper
  contactless boolean, how_to_i18n jsonb, caps_i18n jsonb,
  official_url text, verified_at date
);

-- Plan deviation 3: transit_agencies.card_id -> transit_cards (created after agencies).
alter table transit_agencies add constraint transit_agencies_card_id_fkey
  foreign key (card_id) references transit_cards;

create table fare_rules (
  id serial primary key, agency_id int references transit_agencies,
  mode transit_mode, rule jsonb not null,   -- zones / distance bands / daily cap / off-peak %
  currency char(3) not null, verified_at date
);

create table scenic_routes (
  id serial primary key, country country_code, mode transit_mode,
  slug text unique, name_i18n jsonb, from_name text, to_name text,
  line_i18n jsonb, duration_text text, frequency_text text,
  fare_from numeric(8,2), currency char(3),
  cover_media_id uuid references media_assets,  -- plan deviation 3
  status content_status not null default 'draft'
);

create table airport_transfers (
  id serial primary key, airport_code char(3), city_id int references cities,
  option_name text, mode transit_mode, duration_min int,
  fare_min numeric(6,2), fare_max numeric(6,2), currency char(3),
  verified_at date
);

create table journeys (                     -- curated itineraries + home route showcase
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null default 'itinerary' check (kind in ('itinerary','route_showcase')),
  country country_code, title_i18n jsonb, line_i18n jsonb,
  from_name text, to_name text, days smallint,
  price_from numeric(8,2), currency char(3),
  modes transit_mode[],
  cover_media_id uuid references media_assets,  -- plan deviation 3
  status content_status not null default 'draft'
);

create table journey_legs (
  journey_id uuid references journeys on delete cascade,
  seq smallint, day smallint default 1,
  mode transit_mode not null, from_name text, to_name text,
  operator text, duration_min int, frequency_text text,
  primary key (journey_id, seq)
);

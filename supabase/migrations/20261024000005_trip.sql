-- Spec §14.8 Trip & user data
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null, start_date date, end_date date,
  home_currency char(3) default 'THB',
  deleted_at timestamptz, created_at timestamptz default now(),
  check (end_date >= start_date)
);

create table trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  day_no smallint not null, date date, title text, off_map boolean default false,
  unique (trip_id, day_no)
);

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references trip_days on delete cascade,
  place_id uuid not null references places,
  position smallint not null, time time, note text
);

create table trip_legs (
  from_stop uuid references trip_stops on delete cascade,
  to_stop uuid references trip_stops on delete cascade,
  mode transit_mode, duration_min int, summary text,
  fare_min numeric(6,2), fare_max numeric(6,2),
  status text default 'stale' check (status in ('stale','ok','failed')),
  computed_at timestamptz,
  primary key (from_stop, to_stop)
);

create table saved_items (
  user_id uuid references profiles on delete cascade,
  entity_type saved_entity not null, entity_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, entity_type, entity_id)
);

create table trip_checklist_items (
  trip_id uuid references trips on delete cascade,
  template_id int references checklist_templates,
  done boolean default false, done_at timestamptz,
  primary key (trip_id, template_id)
);

create table trip_packing_items (
  trip_id uuid references trips on delete cascade,
  item_id int references packing_items,
  packed boolean default false,
  primary key (trip_id, item_id)
);

create table trip_shares (
  token text primary key default encode(gen_random_bytes(16),'hex'),
  trip_id uuid references trips on delete cascade,
  created_at timestamptz default now(), revoked_at timestamptz
);

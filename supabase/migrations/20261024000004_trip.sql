create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null,
  start_date date, end_date date,
  home_currency char(3) not null default 'THB',
  share_token text unique,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

create table trip_cities (
  trip_id uuid references trips on delete cascade,
  city_id int references cities,
  arrive date, depart date,
  primary key (trip_id, city_id)
);

create table checklist_templates (
  id serial primary key,
  category text not null,            -- documents, money, sim, transport, packing, biosecurity
  title_i18n jsonb not null, detail_i18n jsonb,
  applies_to country_code[] not null default '{AU,NZ}',
  due_offset_days int,               -- days before start_date
  sort int default 0
);

create table trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  template_id int references checklist_templates,
  category text not null, title text not null,
  due_date date, done boolean not null default false,
  note text, sort int default 0
);

create table trip_budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  category text not null,            -- stay, food, transport, activities, other
  amount numeric(12,2) not null, currency char(3) not null,
  per_day boolean default false
);

create table saved_items (
  user_id uuid references profiles on delete cascade,
  entity_type saved_entity not null,
  entity_id uuid not null,
  trip_id uuid references trips on delete set null,
  created_at timestamptz default now(),
  primary key (user_id, entity_type, entity_id)
);

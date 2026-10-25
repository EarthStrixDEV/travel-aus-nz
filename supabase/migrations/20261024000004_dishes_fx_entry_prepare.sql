-- Spec §14.4 Dishes
create table dishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  country country_code not null, region_id int references regions,
  type text not null,                       -- savoury | sweet | drink | snack
  name_i18n jsonb not null, line_i18n jsonb,
  story_i18n jsonb, dispute_note_i18n jsonb,
  taste_i18n jsonb, served_i18n jsonb, allergy_i18n jsonb,
  dietary text[] default '{}',
  price_level smallint, price_text text,
  must_try_rank smallint, sort int default 0,
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft', verified_at date
);

create table dish_pairings (
  dish_id uuid references dishes on delete cascade,
  k_i18n jsonb, v_i18n jsonb, sort smallint,
  primary key (dish_id, sort)
);

create table dish_venues (
  dish_id uuid references dishes on delete cascade,
  place_id uuid references places on delete cascade,
  region_id int references regions,
  rank smallint not null, price_text text, note_i18n jsonb, verified_at date,
  primary key (dish_id, place_id)
);

-- Spec §14.5 FX
create table currencies (code char(3) primary key, name_i18n jsonb, symbol text, decimals smallint default 2);

create table fx_snapshots (
  fetched_at timestamptz primary key,
  base char(3) not null default 'AUD',
  rates jsonb not null,                     -- {"NZD":1.127,"THB":21.48,...}
  source text not null
);

create table fx_daily (
  day date, quote char(3), close numeric(18,8),
  primary key (day, quote)                  -- base AUD
);

create table cost_reference_items (
  id serial primary key, item_i18n jsonb not null, note_i18n jsonb,
  aud numeric(8,2), nzd numeric(8,2), verified_at date not null, sort int
);

create table budget_presets (
  country country_code, style text check (style in ('budget','comfortable','luxury')),
  per_day numeric(8,2) not null, note_i18n jsonb,
  primary key (country, style)
);

-- Spec §14.6 Entry (Visa)
create table permission_types (
  id serial primary key, country country_code not null, slug text unique,
  name_i18n jsonb, plain_i18n jsonb, who_i18n jsonb, how_i18n jsonb,
  processing_text text, fee_text text, validity_text text, good_i18n jsonb,
  official_link_id int, verified_at date, needs_review boolean default false
);

create table entry_rules (                  -- indicative mapping, editor-maintained
  nationality char(2) not null,             -- ISO 3166-1 alpha-2
  country country_code not null,
  purpose text not null check (purpose in ('tourism','work_study')),
  stay text not null check (stay in ('lt1','1to3','gt3')),
  permission_id int references permission_types,
  verified_at date, needs_review boolean default false,
  primary key (nationality, country, purpose, stay)
);

create table official_links (
  id serial primary key, country country_code, agency text,
  title_i18n jsonb, url text unique not null,
  health_status text default 'ok', content_hash text, last_checked_at timestamptz
);

-- Plan deviation 3: permission_types.official_link_id -> official_links (created after).
alter table permission_types add constraint permission_types_official_link_id_fkey
  foreign key (official_link_id) references official_links;

create table link_checks (
  id bigserial primary key, link_id int references official_links on delete cascade,
  status_code int, final_url text, content_hash text, checked_at timestamptz default now()
);

create table entry_documents (
  id serial primary key, slug text unique, title_i18n jsonb, note_i18n jsonb,
  applies_to country_code[] default '{AU,NZ}', sort int
);

-- Plan deviation 4: length caps (also enforced in the API); user_id set null on account deletion.
create table content_feedback (
  id bigserial primary key,
  entity text check (char_length(entity) <= 120),
  kind text,
  note text check (char_length(note) <= 1000),
  user_id uuid references profiles on delete set null, created_at timestamptz default now(), resolved boolean default false
);

-- Spec §14.7 Prepare
create table checklist_templates (
  id serial primary key, slug text unique,
  moment text not null check (moment in ('3m','1m','1w','day0')),
  title_i18n jsonb, note_i18n jsonb,
  applies_to country_code[] default '{AU,NZ}', sort int
);

create table packing_items (
  id serial primary key, season season, grp text, title_i18n jsonb, sort int
);

create table region_months (
  region_id int references regions, month smallint check (month between 1 and 12),
  comfort smallint, crowds smallint, recommended boolean,
  primary key (region_id, month)
);

create table connectivity_options (
  id serial primary key, name_i18n jsonb, setup_i18n jsonb,
  cost_text text, best_i18n jsonb, watch_i18n jsonb, verified_at date
);

-- Spec §14.1 Core & content.
create extension if not exists postgis  with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;

create type content_status as enum ('draft','published','archived');
create type country_code   as enum ('AU','NZ');
create type place_type     as enum ('attraction','restaurant','bar','cafe','station','village');
create type transit_mode   as enum ('train','metro','tram','bus','coach','ferry','walk');
create type season         as enum ('summer','autumn','winter','spring');
create type user_role      as enum ('user','editor','admin');
create type saved_entity   as enum ('place','dish','journey');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'th' check (locale in ('th','en')),
  home_currency char(3) not null default 'THB',
  theme text default 'system',
  role user_role not null default 'user',
  created_at timestamptz default now()
);

create table regions (
  id serial primary key,
  country country_code not null,
  slug text unique not null,
  name_i18n jsonb not null, state_i18n jsonb, lede_i18n jsonb,
  best_months int[],                        -- e.g. {9,10,11}
  cover_media_id uuid,
  featured_rank smallint,
  status content_status not null default 'draft'
);

create table cities (
  id serial primary key,
  region_id int not null references regions,
  slug text unique not null,
  name_i18n jsonb not null,
  timezone text not null,
  center geography(point,4326) not null,
  bbox geography(polygon,4326),
  status content_status not null default 'draft'
);

create table neighbourhoods (
  id serial primary key, city_id int references cities,
  name text not null, geom geography(polygon,4326)
);

create table tags (
  id serial primary key, slug text unique not null,
  kind text not null,                       -- interest | atmosphere | gallery_type | journey_mode
  name_i18n jsonb not null
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null, width int not null, height int not null,
  blurhash text, alt_i18n jsonb,
  credit text not null, license text not null,
  created_at timestamptz default now()
);

-- Plan deviation 3: regions.cover_media_id -> media_assets (created after regions).
alter table regions add constraint regions_cover_media_id_fkey
  foreign key (cover_media_id) references media_assets;

create table content_blocks (               -- tips, facts, timeline, health
  key text primary key,
  body_i18n jsonb not null,
  verified_at date, updated_at timestamptz default now()
);

create table faqs (
  id serial primary key, scope text not null,
  q_i18n jsonb not null, a_i18n jsonb not null, sort int default 0
);

create table hero_slides (                  -- place_id FK added in 0003 (places is created later)
  id serial primary key, media_id uuid references media_assets,
  caption_i18n jsonb, place_id uuid, sort int default 0, active boolean default true
);

create table newsletter_subscribers (
  email citext primary key, locale text,
  confirmed_at timestamptz, token text unique, created_at timestamptz default now()
);

-- actor: on delete set null so account deletion keeps the audit trail (foundation convention).
create table audit_log (
  id bigserial primary key, table_name text, row_id text, action text,
  diff jsonb, actor uuid references profiles on delete set null, at timestamptz default now()
);

-- Auto-create a profile row for every new auth user
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

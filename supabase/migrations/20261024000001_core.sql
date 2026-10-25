create extension if not exists postgis  with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type content_status as enum ('draft','published','archived');
create type country_code   as enum ('AU','NZ');
create type place_type     as enum ('attraction','restaurant','bar','cafe','market','viewpoint');
create type transit_mode   as enum ('train','metro','tram','bus','ferry','coach');
create type user_role      as enum ('user','editor','admin');
create type saved_entity   as enum ('place','dish','collection');

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  locale        text not null default 'th' check (locale in ('th','en')),
  home_currency char(3) not null default 'THB',
  role          user_role not null default 'user',
  created_at    timestamptz not null default now()
);

create table regions (
  id serial primary key,
  country country_code not null,
  slug text unique not null,
  name_i18n jsonb not null,
  sort int default 0
);

create table cities (
  id serial primary key,
  region_id int not null references regions,
  slug text unique not null,
  name_i18n jsonb not null,
  timezone text not null,            -- e.g. 'Australia/Sydney'
  center geography(point,4326) not null,
  status content_status not null default 'draft'
);

create table tags (
  id serial primary key,
  slug text unique not null,
  name_i18n jsonb not null,
  kind text not null                -- 'vibe' | 'diet' | 'access' ...
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  width int, height int,
  alt_i18n jsonb,
  credit text, license text not null,
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  table_name text not null, row_id text not null,
  action text not null, diff jsonb,
  actor uuid references profiles, at timestamptz default now()
);

-- Auto-create a profile row for every new auth user (spec §2.1)
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

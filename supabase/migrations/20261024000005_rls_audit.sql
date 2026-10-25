-- Task 4: RLS on every public table, role protection, audit log (spec §8.9, §2.7).

-- ---------------------------------------------------------------------------
-- Editor check, reused by every edit policy. Security definer so it can read
-- profiles.role regardless of the caller's profiles RLS. Must stay executable
-- by anon/authenticated: policies evaluate it as the calling role.
-- ---------------------------------------------------------------------------
create function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('editor', 'admin')
  );
$$;
revoke execute on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated, service_role;

-- handle_new_user (Task 2) is a trigger-only security definer function.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on all 36 public tables
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.regions              enable row level security;
alter table public.cities               enable row level security;
alter table public.tags                 enable row level security;
alter table public.media_assets         enable row level security;
alter table public.audit_log            enable row level security;
alter table public.places               enable row level security;
alter table public.place_hours          enable row level security;
alter table public.place_tags           enable row level security;
alter table public.collections          enable row level security;
alter table public.collection_items     enable row level security;
alter table public.transit_agencies     enable row level security;
alter table public.transit_routes       enable row level security;
alter table public.transit_stops        enable row level security;
alter table public.route_stops          enable row level security;
alter table public.transit_cards        enable row level security;
alter table public.city_climate         enable row level security;
alter table public.currencies           enable row level security;
alter table public.fx_rates             enable row level security;
alter table public.fx_rates_daily       enable row level security;
alter table public.cost_reference_items enable row level security;
alter table public.fx_alerts            enable row level security;
alter table public.dish_categories      enable row level security;
alter table public.dishes               enable row level security;
alter table public.dish_venues          enable row level security;
alter table public.official_links       enable row level security;
alter table public.visa_guide_sections  enable row level security;
alter table public.section_links        enable row level security;
alter table public.link_checks          enable row level security;
alter table public.content_feedback     enable row level security;
alter table public.trips                enable row level security;
alter table public.trip_cities          enable row level security;
alter table public.checklist_templates  enable row level security;
alter table public.trip_checklist_items enable row level security;
alter table public.trip_budget_items    enable row level security;
alter table public.saved_items          enable row level security;

-- Service role only (RLS on, no policies): fx_rates, link_checks, audit_log, content_feedback.

-- ---------------------------------------------------------------------------
-- Status tables: public reads published rows, editors do everything
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cities','places','collections','dishes','visa_guide_sections'] loop
    execute format('create policy %I on public.%I for select using (status = ''published'')', t || '_read', t);
    execute format('create policy %I on public.%I for all using ((select public.is_editor())) with check ((select public.is_editor()))', t || '_edit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference tables: public read, editor write
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'regions','tags','media_assets','place_hours','place_tags','collection_items',
    'transit_agencies','transit_routes','transit_stops','route_stops','transit_cards',
    'city_climate','currencies','fx_rates_daily','cost_reference_items','dish_categories',
    'dish_venues','official_links','section_links','checklist_templates'
  ] loop
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all using ((select public.is_editor())) with check ((select public.is_editor()))', t || '_edit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Owner tables
-- ---------------------------------------------------------------------------
create policy trips_owner on public.trips for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy fx_alerts_owner on public.fx_alerts for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- saved_items.trip_id, when set, must also be one of the caller's trips.
create policy saved_items_owner on public.saved_items for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (trip_id is null or exists (
      select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  );

-- Trip children: ownership via the parent trip, on read and on write.
do $$
declare t text;
begin
  foreach t in array array['trip_cities','trip_checklist_items','trip_budget_items'] loop
    execute format(
      'create policy %I on public.%I for all
         using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
         with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))',
      t || '_owner', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: read/update self only; role is not user-writable (column grants).
-- No insert/delete policies: rows come from handle_new_user / auth cascade.
-- ---------------------------------------------------------------------------
create policy profile_select_self on public.profiles for select
  using (id = (select auth.uid()));
create policy profile_update_self on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from anon, authenticated;
grant update (display_name, locale, home_currency) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at / updated_by maintenance
-- places, dishes: updated_at + updated_by; collections: updated_at only.
-- ---------------------------------------------------------------------------
create function public.touch_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name in ('places', 'dishes') then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.touch_updated() from public, anon, authenticated;

create trigger places_touch_updated      before update on public.places      for each row execute function public.touch_updated();
create trigger dishes_touch_updated      before update on public.dishes      for each row execute function public.touch_updated();
create trigger collections_touch_updated before update on public.collections for each row execute function public.touch_updated();

-- ---------------------------------------------------------------------------
-- Content audit (security definer: audit_log has no policies)
-- ---------------------------------------------------------------------------
create function public.audit_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if tg_op = 'DELETE' then
    r := to_jsonb(old);
  else
    r := to_jsonb(new);
  end if;
  insert into public.audit_log (table_name, row_id, action, diff, actor)
  values (tg_table_name, r->>'id', tg_op, r, auth.uid());
  return null;
end;
$$;
revoke execute on function public.audit_content() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['cities','places','collections','dishes','visa_guide_sections'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_content()',
      t || '_audit', t);
  end loop;
end $$;

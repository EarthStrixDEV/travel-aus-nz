-- Spec §14.9 RLS + plan deviations 2-3: RLS on every public table, role protection,
-- audit + updated_at triggers on content tables.

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

-- handle_new_user is a trigger-only security definer function.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every public table (all 59). Tables without a policy below are
-- service-role only: link_checks, audit_log, content_feedback, newsletter_subscribers.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Status tables: public reads published rows, editors do everything
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'regions','cities','places','dishes','collections','gallery_photos','journeys','scenic_routes'
  ] loop
    execute format('create policy %I on public.%I for select using (status = ''published'')', t || '_read', t);
    execute format('create policy %I on public.%I for all using ((select public.is_editor())) with check ((select public.is_editor()))', t || '_edit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference tables: public read + editor write.
-- permission_types / entry_rules are in spec §14.9's status list but have no
-- status column, so they are public reference data here.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'neighbourhoods','tags','media_assets','content_blocks','faqs','hero_slides','cuisines',
    'transit_agencies','transit_stops','transit_lines','line_stops','line_service_summary',
    'transit_cards','fare_rules','airport_transfers',
    'currencies','cost_reference_items','budget_presets',
    'permission_types','entry_rules','official_links','entry_documents',
    'checklist_templates','packing_items','connectivity_options'
  ] loop
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all using ((select public.is_editor())) with check ((select public.is_editor()))', t || '_edit', t);
  end loop;
end $$;

-- FX: public read; written by the service role (jobs) only.
create policy fx_snapshots_read on public.fx_snapshots for select using (true);
create policy fx_daily_read     on public.fx_daily     for select using (true);

-- ---------------------------------------------------------------------------
-- Children of status tables: editor write; public read inherited from the
-- parent's RLS (rows of draft/archived parents stay hidden).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'place_hours','place_tags','place_stop_links','place_nearby_venues','venues','venue_drinks',
    'collection_items','journey_legs','dish_pairings','dish_venues','region_months'
  ] loop
    execute format('create policy %I on public.%I for all using ((select public.is_editor())) with check ((select public.is_editor()))', t || '_edit', t);
  end loop;

  foreach t in array array['place_hours','place_tags','place_stop_links','venues','venue_drinks'] loop
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.places p where p.id = place_id))', t || '_read', t);
  end loop;
end $$;

create policy place_nearby_venues_read on public.place_nearby_venues for select
  using (exists (select 1 from public.places p where p.id = place_id)
     and exists (select 1 from public.places v where v.id = venue_id));
create policy collection_items_read on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id));
create policy journey_legs_read on public.journey_legs for select
  using (exists (select 1 from public.journeys j where j.id = journey_id));
create policy dish_pairings_read on public.dish_pairings for select
  using (exists (select 1 from public.dishes d where d.id = dish_id));
create policy dish_venues_read on public.dish_venues for select
  using (exists (select 1 from public.dishes d where d.id = dish_id)
     and exists (select 1 from public.places p where p.id = place_id));
create policy region_months_read on public.region_months for select
  using (exists (select 1 from public.regions r where r.id = region_id));

-- ---------------------------------------------------------------------------
-- User data: owner only, via the chain back to trips.user_id
-- ---------------------------------------------------------------------------
create policy trips_owner on public.trips for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy saved_items_owner on public.saved_items for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['trip_days','trip_checklist_items','trip_packing_items','trip_shares'] loop
    execute format(
      'create policy %I on public.%I for all
         using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
         with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))',
      t || '_owner', t);
  end loop;
end $$;

create policy trip_stops_owner on public.trip_stops for all
  using (exists (
    select 1 from public.trip_days d join public.trips t on t.id = d.trip_id
    where d.id = day_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.trip_days d join public.trips t on t.id = d.trip_id
    where d.id = day_id and t.user_id = (select auth.uid())));

-- Both ends of a leg must belong to the caller.
create policy trip_legs_owner on public.trip_legs for all
  using (exists (
    select 1 from public.trip_stops s
    join public.trip_days d on d.id = s.day_id
    join public.trips t on t.id = d.trip_id
    where s.id = from_stop and t.user_id = (select auth.uid())))
  with check (
    exists (
      select 1 from public.trip_stops s
      join public.trip_days d on d.id = s.day_id
      join public.trips t on t.id = d.trip_id
      where s.id = from_stop and t.user_id = (select auth.uid()))
    and exists (
      select 1 from public.trip_stops s
      join public.trip_days d on d.id = s.day_id
      join public.trips t on t.id = d.trip_id
      where s.id = to_stop and t.user_id = (select auth.uid())));

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
grant update (display_name, locale, home_currency, theme) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at / updated_by maintenance (only tables whose §14 DDL has updated_at)
-- places: updated_at + updated_by; content_blocks: updated_at.
-- ---------------------------------------------------------------------------
create function public.touch_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'places' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.touch_updated() from public, anon, authenticated;

create trigger places_touch_updated         before update on public.places         for each row execute function public.touch_updated();
create trigger content_blocks_touch_updated before update on public.content_blocks for each row execute function public.touch_updated();

-- ---------------------------------------------------------------------------
-- Content audit (security definer: audit_log has no policies).
-- row_id: id, else key (content_blocks), else the entry_rules composite key.
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
  values (
    tg_table_name,
    coalesce(r->>'id', r->>'key',
      case when tg_table_name = 'entry_rules'
        then concat_ws(':', r->>'nationality', r->>'country', r->>'purpose', r->>'stay') end),
    tg_op, r, auth.uid());
  return null;
end;
$$;
revoke execute on function public.audit_content() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'regions','cities','places','collections','gallery_photos','journeys','scenic_routes',
    'dishes','permission_types','entry_rules','content_blocks'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_content()',
      t || '_audit', t);
  end loop;
end $$;

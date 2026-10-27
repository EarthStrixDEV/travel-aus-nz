-- My Trip operations (spec §13, Phase 2 plan Task 5). Every function is security invoker, so the
-- trips/trip_days/trip_stops/trip_legs owner policies still decide what a caller can touch: another
-- user's ids simply match no rows.

-- Leg recompute retries (Task 6): a leg is `failed` after 3 attempts.
alter table public.trip_legs add column attempts smallint not null default 0;

-- Stop order within a day. Deferred so a reorder can pass through duplicate positions inside one statement.
alter table public.trip_stops
  add constraint trip_stops_day_position_key unique (day_id, position) deferrable initially deferred;

-- A trip with one trip_days row per date (no dates -> Day 1 only). At most 60 days.
create or replace function public.create_trip(p_title text, p_start date default null, p_end date default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip uuid;
  v_days int;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_start is not null and p_end is not null and p_end - p_start > 59 then
    raise exception 'a trip is at most 60 days' using errcode = '22023';
  end if;
  insert into public.trips (user_id, title, start_date, end_date)
  values (auth.uid(), p_title, p_start, p_end)
  returning id into v_trip;

  v_days := case when p_start is null or p_end is null then 1 else p_end - p_start + 1 end;
  insert into public.trip_days (trip_id, day_no, date)
  select v_trip, n, case when p_start is null or p_end is null then null else p_start + (n - 1) end
  from generate_series(1, v_days) as n;
  return v_trip;
end $$;

-- Renumber a day's stops 1..n (by position, then id) and make trip_legs match consecutive pairs:
-- a pair that is no longer consecutive loses its leg; a new pair gets a `stale` leg; an unchanged pair
-- keeps its computed leg. Called after every add / delete / move.
create or replace function public.normalize_trip_day(p_day uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with r as (
    select id, (row_number() over (order by position, id))::smallint as pos
    from public.trip_stops where day_id = p_day
  )
  update public.trip_stops s set position = r.pos from r where s.id = r.id and s.position <> r.pos;

  with pairs as (
    select id as from_stop, lead(id) over (order by position) as to_stop
    from public.trip_stops where day_id = p_day
  )
  delete from public.trip_legs l
  using public.trip_stops s
  where s.id = l.from_stop
    and s.day_id = p_day
    and not exists (select 1 from pairs p where p.from_stop = l.from_stop and p.to_stop = l.to_stop);

  insert into public.trip_legs (from_stop, to_stop)
  select from_stop, to_stop
  from (
    select id as from_stop, lead(id) over (order by position) as to_stop
    from public.trip_stops where day_id = p_day
  ) pairs
  where to_stop is not null
  on conflict (from_stop, to_stop) do nothing;
end $$;

-- Move a stop to `p_position` (1-based, clamped) on `p_day`, which must be a day of the same trip.
-- Both days are renumbered and their legs re-synced (the moved stop's neighbours become `stale`).
create or replace function public.move_trip_stop(p_stop uuid, p_day uuid, p_position int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old uuid;
begin
  select day_id into v_old from public.trip_stops where id = p_stop;
  if v_old is null then
    raise exception 'stop not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.trip_days a join public.trip_days b on b.trip_id = a.trip_id
    where a.id = v_old and b.id = p_day
  ) then
    raise exception 'day not found' using errcode = 'P0002';
  end if;

  -- Others on the target day go to even slots, the moved stop to the odd slot just before its target,
  -- then normalize renumbers 1..n.
  update public.trip_stops s set position = (r.rn * 2)::smallint
  from (
    select id, row_number() over (order by position, id) as rn
    from public.trip_stops where day_id = p_day and id <> p_stop
  ) r
  where s.id = r.id;
  update public.trip_stops set day_id = p_day, position = (greatest(p_position, 1) * 2 - 1)::smallint where id = p_stop;

  perform public.normalize_trip_day(p_day);
  if v_old <> p_day then
    perform public.normalize_trip_day(v_old);
  end if;
end $$;

grant execute on function public.create_trip(text, date, date) to authenticated;
grant execute on function public.normalize_trip_day(uuid) to authenticated;
grant execute on function public.move_trip_stop(uuid, uuid, int) to authenticated;
revoke execute on function public.create_trip(text, date, date) from anon;
revoke execute on function public.normalize_trip_day(uuid) from anon;
revoke execute on function public.move_trip_stop(uuid, uuid, int) from anon;

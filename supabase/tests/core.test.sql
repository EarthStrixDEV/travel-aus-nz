begin;
create extension if not exists pgtap;
select plan(9);

select has_extension('extensions'::name, 'postgis'::name);
select has_extension('extensions'::name, 'pg_trgm'::name);
select has_extension('extensions'::name, 'pgcrypto'::name);
select has_extension('extensions'::name, 'citext'::name);
select has_table('public'::name, 'profiles'::name);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'earth@example.com', '{"full_name":"Earth"}');

select results_eq(
  $$select locale, home_currency::text, theme, role::text, display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('th'::text, 'THB'::text, 'system'::text, 'user'::text, 'Earth'::text)$$,
  'profile auto-created with defaults and display_name from metadata'
);

-- Reference data (migration 0008): three published MVP cities, each with a bbox containing its center
select results_eq(
  $$select slug from public.cities
    where status = 'published' and slug in ('sydney','melbourne','auckland')
      and bbox is not null and extensions.st_covers(bbox, center)
    order by slug$$,
  $$values ('auckland'::text), ('melbourne'), ('sydney')$$,
  'Sydney, Melbourne, Auckland published with bbox covering center'
);

select results_eq(
  $$select r.slug, r.country::text from public.regions r
    where r.slug in ('sydney','melbourne','auckland') and r.status = 'published'
    order by r.slug$$,
  $$values ('auckland'::text, 'NZ'::text), ('melbourne', 'AU'), ('sydney', 'AU')$$,
  'reference regions published with the right country'
);

select results_eq(
  $$select c.slug, c.timezone from public.cities c
    join public.regions r on r.id = c.region_id and r.slug = c.slug
    where c.slug in ('sydney','melbourne','auckland') order by c.slug$$,
  $$values ('auckland'::text, 'Pacific/Auckland'::text), ('melbourne', 'Australia/Melbourne'), ('sydney', 'Australia/Sydney')$$,
  'each MVP city sits in its region with its IANA time zone'
);

select * from finish();
rollback;

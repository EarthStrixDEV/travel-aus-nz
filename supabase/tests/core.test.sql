begin;
create extension if not exists pgtap;
select plan(6);

select has_extension('postgis');
select has_extension('pg_trgm');
select has_table('public'::name, 'profiles'::name);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', 'earth@example.com', '{"full_name":"Earth"}');

select results_eq(
  $$select locale, home_currency::text, role::text, display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('th'::text, 'THB'::text, 'user'::text, 'Earth'::text)$$,
  'profile auto-created with defaults and display_name from metadata'
);

select results_eq(
  $$select count(*)::int from public.cities where status = 'published'$$,
  array[3],
  'three published cities seeded'
);

select results_eq(
  $$select count(*)::int from public.regions$$,
  array[3],
  'three regions seeded'
);

select * from finish();
rollback;

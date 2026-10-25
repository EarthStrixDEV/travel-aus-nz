-- Reference data required in every environment (regions, MVP cities, currencies).
-- Idempotent: safe to re-run; existing rows are left untouched.

insert into public.regions (country, slug, name_i18n, sort) values
  ('AU', 'nsw',      '{"en":"New South Wales","th":"นิวเซาท์เวลส์"}', 1),
  ('AU', 'vic',      '{"en":"Victoria","th":"วิกตอเรีย"}',           2),
  ('NZ', 'auckland', '{"en":"Auckland","th":"โอ๊คแลนด์"}',            3)
on conflict (slug) do nothing;

insert into public.cities (region_id, slug, name_i18n, timezone, center, status)
select r.id, v.slug, v.name_i18n::jsonb, v.timezone, v.center::extensions.geography, 'published'::public.content_status
from (values
  ('nsw',      'sydney',    '{"en":"Sydney","th":"ซิดนีย์"}',      'Australia/Sydney',    'SRID=4326;POINT(151.2093 -33.8688)'),
  ('vic',      'melbourne', '{"en":"Melbourne","th":"เมลเบิร์น"}', 'Australia/Melbourne', 'SRID=4326;POINT(144.9631 -37.8136)'),
  ('auckland', 'auckland',  '{"en":"Auckland","th":"โอ๊คแลนด์"}',  'Pacific/Auckland',    'SRID=4326;POINT(174.7633 -36.8485)')
) as v(region_slug, slug, name_i18n, timezone, center)
join public.regions r on r.slug = v.region_slug
on conflict (slug) do nothing;

insert into public.currencies (code, name_i18n, symbol, decimals) values
  ('THB', '{"en":"Thai Baht","th":"บาทไทย"}',                 '฿',   2),
  ('AUD', '{"en":"Australian Dollar","th":"ดอลลาร์ออสเตรเลีย"}', 'A$',  2),
  ('NZD', '{"en":"New Zealand Dollar","th":"ดอลลาร์นิวซีแลนด์"}', 'NZ$', 2),
  ('USD', '{"en":"US Dollar","th":"ดอลลาร์สหรัฐ"}',            '$',   2)
on conflict (code) do nothing;

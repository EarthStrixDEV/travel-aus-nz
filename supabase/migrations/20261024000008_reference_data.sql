-- Reference data required in every environment: MVP regions + cities (with bbox),
-- currencies (spec §10), and content_blocks keys the app reads.
-- Idempotent: safe to re-run; existing rows are left untouched.
-- Editorial fields (lede, best_months, featured_rank, cover) are content, not reference data.

insert into public.regions (country, slug, name_i18n, state_i18n, status) values
  ('AU', 'sydney',    '{"en":"Sydney","th":"ซิดนีย์"}',      '{"en":"New South Wales","th":"นิวเซาท์เวลส์"}', 'published'),
  ('AU', 'melbourne', '{"en":"Melbourne","th":"เมลเบิร์น"}', '{"en":"Victoria","th":"วิกตอเรีย"}',           'published'),
  ('NZ', 'auckland',  '{"en":"Auckland","th":"โอ๊คแลนด์"}',  '{"en":"Tāmaki Makaurau"}',                      'published')
on conflict (slug) do nothing;

insert into public.cities (region_id, slug, name_i18n, timezone, center, bbox, status)
select r.id, v.slug, v.name_i18n::jsonb, v.timezone,
       v.center::extensions.geography, v.bbox::extensions.geography, 'published'::public.content_status
from (values
  ('sydney',    'sydney',    '{"en":"Sydney","th":"ซิดนีย์"}',      'Australia/Sydney',
   'SRID=4326;POINT(151.2093 -33.8688)',
   'SRID=4326;POLYGON((150.52 -34.17, 151.35 -34.17, 151.35 -33.57, 150.52 -33.57, 150.52 -34.17))'),
  ('melbourne', 'melbourne', '{"en":"Melbourne","th":"เมลเบิร์น"}', 'Australia/Melbourne',
   'SRID=4326;POINT(144.9631 -37.8136)',
   'SRID=4326;POLYGON((144.55 -38.10, 145.30 -38.10, 145.30 -37.55, 144.55 -37.55, 144.55 -38.10))'),
  ('auckland',  'auckland',  '{"en":"Auckland","th":"โอ๊คแลนด์"}',  'Pacific/Auckland',
   'SRID=4326;POINT(174.7633 -36.8485)',
   'SRID=4326;POLYGON((174.55 -37.10, 175.15 -37.10, 175.15 -36.70, 174.55 -36.70, 174.55 -37.10))')
) as v(region_slug, slug, name_i18n, timezone, center, bbox)
join public.regions r on r.slug = v.region_slug
on conflict (slug) do nothing;

insert into public.currencies (code, name_i18n, symbol, decimals) values
  ('THB', '{"en":"Thai baht","th":"บาทไทย"}',                    '฿',   2),
  ('USD', '{"en":"US dollar","th":"ดอลลาร์สหรัฐ"}',               'US$', 2),
  ('EUR', '{"en":"Euro","th":"ยูโร"}',                           '€',   2),
  ('GBP', '{"en":"British pound","th":"ปอนด์สเตอร์ลิง"}',          '£',   2),
  ('JPY', '{"en":"Japanese yen","th":"เยนญี่ปุ่น"}',               '¥',   0),
  ('SGD', '{"en":"Singapore dollar","th":"ดอลลาร์สิงคโปร์"}',       'S$',  2),
  ('CNY', '{"en":"Chinese yuan","th":"หยวนจีน"}',                 'CN¥', 2),
  ('AUD', '{"en":"Australian dollar","th":"ดอลลาร์ออสเตรเลีย"}',   'A$',  2),
  ('NZD', '{"en":"New Zealand dollar","th":"ดอลลาร์นิวซีแลนด์"}',   'NZ$', 2)
on conflict (code) do nothing;

insert into public.content_blocks (key, body_i18n) values
  ('money_tips',     '{}'),
  ('entry_timeline', '{}')
on conflict (key) do nothing;

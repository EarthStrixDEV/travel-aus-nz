insert into public.regions (country, slug, name_i18n, sort) values
  ('AU', 'nsw',      '{"en":"New South Wales","th":"นิวเซาท์เวลส์"}', 1),
  ('AU', 'vic',      '{"en":"Victoria","th":"วิกตอเรีย"}',           2),
  ('NZ', 'auckland', '{"en":"Auckland","th":"โอ๊คแลนด์"}',            3);

insert into public.cities (region_id, slug, name_i18n, timezone, center, status) values
  ((select id from public.regions where slug = 'nsw'),      'sydney',    '{"en":"Sydney","th":"ซิดนีย์"}',      'Australia/Sydney',    'SRID=4326;POINT(151.2093 -33.8688)', 'published'),
  ((select id from public.regions where slug = 'vic'),      'melbourne', '{"en":"Melbourne","th":"เมลเบิร์น"}', 'Australia/Melbourne', 'SRID=4326;POINT(144.9631 -37.8136)', 'published'),
  ((select id from public.regions where slug = 'auckland'), 'auckland',  '{"en":"Auckland","th":"โอ๊คแลนด์"}',  'Pacific/Auckland',    'SRID=4326;POINT(174.7633 -36.8485)', 'published');

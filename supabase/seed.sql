-- Dev-only sample content (loaded by `supabase db reset`), taken from the design
-- artboards in design/pages/ (Main, Map, Dining, Gallery, Currency, Visa).
-- Reference data (MVP regions/cities, currencies, content_blocks keys) lives in
-- migrations/20261024000008_reference_data.sql.
--
-- Every price, fare, fee and rate here is a PLACEHOLDER: verified_at is left null
-- wherever the column allows it, so the UI shows "Placeholder". The one exception is
-- cost_reference_items.verified_at, which the spec makes NOT NULL.

-- ---------------------------------------------------------------------------
-- Regions (Home: featured regions, AU / NZ)
-- ---------------------------------------------------------------------------
update public.regions set
  lede_i18n = '{"en":"A harbour city best seen from the water: ferries to Manly and Watsons Bay, coastal walks, and a dining scene spread across walkable neighbourhoods."}',
  best_months = '{9,10,11}', featured_rank = 1
where slug = 'sydney';
update public.regions set
  lede_i18n = '{"en":"Laneways, trams and the country''s best coffee."}', featured_rank = 3
where slug = 'melbourne';
update public.regions set
  lede_i18n = '{"en":"Harbour ferries to islands, vineyards and black-sand beaches."}', featured_rank = 4
where slug = 'auckland';

insert into public.regions (country, slug, name_i18n, state_i18n, lede_i18n, best_months, featured_rank, status) values
  ('AU', 'tasmania', '{"en":"Tasmania","th":"แทสเมเนีย"}', '{"en":"Island state"}',
   '{"en":"Hobart''s waterfront, MONA by ferry, and wilderness a coach ride away."}', '{12,1,2,3}', 2, 'published'),
  ('AU', 'great-barrier-reef', '{"en":"Great Barrier Reef","th":"เกรตแบร์ริเออร์รีฟ"}', '{"en":"Queensland"}',
   '{"en":"Reach the reef by fast catamaran from Cairns or Port Douglas."}', '{6,7,8,9,10}', 4, 'published'),
  ('NZ', 'fiordland', '{"en":"Fiordland"}', '{"en":"Southland"}',
   '{"en":"Glacier-carved fiords reached by coach from Queenstown or Te Anau, then explored by cruise or kayak."}', '{11,12,1,2,3,4}', 1, 'published'),
  ('NZ', 'queenstown', '{"en":"Queenstown","th":"ควีนส์ทาวน์"}', '{"en":"Otago"}',
   '{"en":"Alpine lakes, Central Otago pinot, and the Orbus network into town."}', '{12,1,2,3}', 2, 'published'),
  ('NZ', 'wellington', '{"en":"Wellington","th":"เวลลิงตัน"}', '{"en":"Capital"}',
   '{"en":"A compact harbour capital made for walking."}', null, 3, 'published')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Media placeholders (no real files yet)
-- ---------------------------------------------------------------------------
insert into public.media_assets (id, path, width, height, alt_i18n, credit, license) values
  ('a0000000-0000-0000-0000-000000000001', 'placeholder/milford-sound.jpg',      1600,  900, '{"en":"Milford Sound, Fiordland"}',            'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000002', 'placeholder/sydney-harbour.jpg',     1600,  900, '{"en":"Sydney Harbour at first light"}',       'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000003', 'placeholder/cradle-mountain.jpg',    1600,  900, '{"en":"Cradle Mountain, Tasmania"}',           'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000004', 'placeholder/lake-wakatipu.jpg',      1600,  900, '{"en":"Lake Wakatipu, Queenstown"}',           'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000011', 'placeholder/bondi-coogee.jpg',       1200, 1500, '{"en":"Bondi to Coogee coastal walk"}',        'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000012', 'placeholder/opera-house.jpg',        1500, 1000, '{"en":"Sydney Opera House from the ferry"}',   'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000013', 'placeholder/hosier-lane.jpg',        1000, 1500, '{"en":"Hosier Lane at dusk"}',                 'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000014', 'placeholder/waiheke-vineyards.jpg',  1500, 1000, '{"en":"Waiheke Island vineyards"}',            'Placeholder', 'placeholder'),
  ('a0000000-0000-0000-0000-000000000015', 'placeholder/botanic-garden.jpg',     1500, 1000, '{"en":"Royal Botanic Garden, Farm Cove"}',     'Placeholder', 'placeholder');

-- ---------------------------------------------------------------------------
-- Neighbourhoods (Map clusters at low zoom)
-- ---------------------------------------------------------------------------
insert into public.neighbourhoods (city_id, name)
select c.id, v.name
from (values
  ('sydney', 'The Rocks'), ('sydney', 'Sydney CBD'), ('sydney', 'Surry Hills'), ('sydney', 'Haymarket'),
  ('sydney', 'Woolloomooloo'), ('sydney', 'Potts Point'), ('sydney', 'Pyrmont'), ('sydney', 'Barangaroo'),
  ('sydney', 'Bondi'),
  ('melbourne', 'Melbourne CBD'), ('melbourne', 'Fitzroy'),
  ('auckland', 'Ponsonby'), ('auckland', 'Viaduct'), ('auckland', 'Auckland CBD'), ('auckland', 'Waiheke Island')
) as v(city, name)
join public.cities c on c.slug = v.city;

-- ---------------------------------------------------------------------------
-- Places (Map, Eat & Drink, Gallery). All published.
-- ---------------------------------------------------------------------------
insert into public.places (city_id, neighbourhood_id, slug, type, category, name_i18n, area_i18n, desc_i18n,
                           best_time_i18n, access_i18n, geom, price_level, price_note_i18n, hours_note_i18n, status)
select c.id, n.id, v.slug, v.type::public.place_type, v.category, jsonb_build_object('en', v.name),
       jsonb_build_object('en', v.area), jsonb_build_object('en', v.descr),
       case when v.best is null then null else jsonb_build_object('en', v.best) end,
       case when v.access is null then null else jsonb_build_object('en', v.access) end,
       format('SRID=4326;POINT(%s %s)', v.lng, v.lat)::extensions.geography,
       v.price, case when v.price_note is null then null else jsonb_build_object('en', v.price_note) end,
       case when v.hours_note is null then null else jsonb_build_object('en', v.hours_note) end,
       'published'
from (values
  -- Sydney attractions
  ('sydney', 'The Rocks',     'sydney-opera-house',       'attraction', 'Heritage', 'Sydney Opera House',      'Bennelong Point', 'Join the first morning tour for the quietest halls, then walk the forecourt to the Botanic Garden.', 'Year-round; Sep–Nov is mild', 'Train or ferry to Circular Quay, then a 7-minute harbourside walk.', 151.2153, -33.8568, 2, 'Guided tours A$45–69', 'Performances most evenings'),
  ('sydney', 'Sydney CBD',    'royal-botanic-garden',     'attraction', 'City',     'Royal Botanic Garden',    'Farm Cove',       'Harbour-edge lawns and the walk to Mrs Macquarie’s Chair, best in the early light.', null, null, 151.2166, -33.8642, 0, 'Free entry', 'Until 20:00 in summer'),
  ('sydney', 'Sydney CBD',    'art-gallery-of-nsw',       'attraction', null,       'Art Gallery of NSW',      'The Domain',      'Two buildings joined by a garden path. The underground Tank gallery is worth the descent.', null, null, 151.2173, -33.8688, 0, 'General entry free', 'Wednesday until 22:00'),
  ('sydney', 'Sydney CBD',    'hyde-park-barracks',       'attraction', 'Heritage', 'Hyde Park Barracks',      'Macquarie Street','A convict-era building turned into one of the city’s best small museums.', null, null, 151.2128, -33.8695, 1, 'Adults A$26', 'Audio guide included'),
  ('sydney', 'Barangaroo',    'barangaroo-reserve',       'attraction', null,       'Barangaroo Reserve',      'Barangaroo',      'A sandstone headland park planted with native species, at its best around sunset.', null, null, 151.2019, -33.8555, 0, 'Free', 'Cultural walks on weekends'),
  ('sydney', 'Bondi',         'bondi-to-coogee-walk',     'attraction', 'Beach',    'Bondi to Coogee coastal walk', 'Bondi',       'Six kilometres of sandstone cliffs, ocean pools and bays.', 'Nov–Mar, early morning', 'Bus 333 from the CBD to Bondi Beach, about 30 min. Return on bus 373 from Coogee.', 151.2743, -33.8915, 0, 'Free', null),
  -- Sydney restaurants
  ('sydney', 'The Rocks',     'harbourline-oyster-room',  'restaurant', null, 'Harbourline Oyster Room', 'The Rocks',     'Sydney rock oysters by the dozen and a short, coastal wine list, in a sandstone warehouse by the water.', null, null, 151.2087, -33.8590, 3, 'Mains A$42–68', 'Closed Mondays'),
  ('sydney', 'Sydney CBD',    'ash-and-ember',            'restaurant', null, 'Ash & Ember',             'CBD',           'Wood-fired tasting menu built around NSW producers, with a counter facing the hearth.', null, null, 151.2100, -33.8680, 4, 'Set menu A$195', 'Lunch Friday only'),
  ('sydney', 'Haymarket',     'kin-noodle-bar',           'restaurant', null, 'Kin Noodle Bar',          'Haymarket',     'Hand-pulled noodles and chilli oil, fast and very good, a block from Chinatown.', null, null, 151.2045, -33.8795, 1, 'Bowls A$18–24', 'No bookings'),
  ('sydney', 'Woolloomooloo', 'wharf-street-trattoria',   'restaurant', null, 'Wharf Street Trattoria',  'Woolloomooloo', 'Fresh pasta on the finger wharf, with a view back across to the gardens.', null, null, 151.2215, -33.8690, 2, 'Pasta A$28–36', 'Terrace seats unbooked'),
  ('sydney', 'Surry Hills',   'saltbush-dining-room',     'restaurant', null, 'Saltbush Dining Room',    'Surry Hills',   'Native produce handled lightly: wattleseed bread, kangaroo tartare, finger-lime desserts.', null, null, 151.2115, -33.8840, 3, 'Mains A$38–56', 'Bar seats held for walk-ins'),
  -- Sydney bars
  ('sydney', 'Sydney CBD',    'the-lantern-room',         'bar', null, 'The Lantern Room', 'CBD rooftop', 'Rooftop cocktails twelve floors up, with a narrow view to the bridge.', null, null, 151.2060, -33.8670, 3, 'Cocktails A$24–28', 'Dress: smart casual'),
  ('sydney', 'Sydney CBD',    'archive-bar',              'bar', null, 'Archive Bar',      'CBD',         'A basement whisky bar with more than 400 bottles and a librarian’s patience.', null, null, 151.2075, -33.8725, 2, 'Cocktails A$22', 'Unmarked door off the lane'),
  ('sydney', 'Potts Point',   'low-tide',                 'bar', null, 'Low Tide',         'Potts Point', 'Natural wine and tinned fish on a leafy corner terrace.', null, null, 151.2250, -33.8710, 2, 'Glass A$15–22', 'Snacks until 22:00'),
  ('sydney', 'Pyrmont',       'pyrmont-social',           'bar', null, 'Pyrmont Social',   'Pyrmont',     'A local’s pub with an excellent NSW craft beer list.', null, null, 151.1945, -33.8700, 2, 'Pints A$13', 'Live music Fridays'),
  -- Sydney stations
  ('sydney', 'The Rocks',     'circular-quay-station',    'station', null, 'Circular Quay Station', 'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2108, -33.8615, null, 'Opal card or contactless', 'NightRide buses overnight'),
  ('sydney', 'Sydney CBD',    'wynyard-station',          'station', null, 'Wynyard Station',       'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2057, -33.8658, null, 'Opal card or contactless', 'NightRide buses overnight'),
  ('sydney', 'Sydney CBD',    'martin-place-station',     'station', null, 'Martin Place Station',  'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2113, -33.8679, null, 'Opal card or contactless', 'NightRide buses overnight'),
  ('sydney', 'Sydney CBD',    'town-hall-station',        'station', null, 'Town Hall Station',     'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2067, -33.8732, null, 'Opal card or contactless', 'NightRide buses overnight'),
  ('sydney', 'Haymarket',     'central-station',          'station', null, 'Central Station',       'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2065, -33.8830, null, 'Opal card or contactless', 'NightRide buses overnight'),
  ('sydney', 'Potts Point',   'kings-cross-station',      'station', null, 'Kings Cross Station',   'Sydney Trains', 'Trains every 3–5 minutes on the City Circle. Tap on and off with Opal or a contactless card.', null, null, 151.2222, -33.8752, null, 'Opal card or contactless', 'NightRide buses overnight'),
  -- Melbourne
  ('melbourne', 'Melbourne CBD', 'hosier-lane',           'attraction', 'City', 'Hosier Lane', 'Melbourne CBD', 'The city’s most photographed laneway, repainted every few weeks.', 'Mar–May', 'Tram to Flinders Street, 3-minute walk. Free Tram Zone.', 144.9691, -37.8165, 0, 'Free', null),
  ('melbourne', 'Melbourne CBD', 'hollow-lane',           'bar',  null, 'Hollow Lane',    'CBD',     'Unmarked door, low lamps, a short list of very good cocktails.', null, null, 144.9650, -37.8150, 2, 'Cocktails A$22–26', null),
  ('melbourne', 'Fitzroy',       'kettle-and-kiln',       'cafe', null, 'Kettle & Kiln',  'Fitzroy', 'Breakfast worth queueing for, in an old pottery works.', null, null, 144.9790, -37.8030, 1, 'Breakfast A$16–24', null),
  ('melbourne', 'Melbourne CBD', 'flinders-street-station','station', null, 'Flinders Street Station', 'Metro Trains', 'The city’s main suburban hub; trams stop outside on Flinders and Swanston Streets.', null, null, 144.9671, -37.8183, null, 'myki only', null),
  -- Auckland
  ('auckland', 'Ponsonby',       'kokako-kitchen',        'restaurant', null, 'Kōkako Kitchen',   'Ponsonby', 'Contemporary Māori cooking built around seasonal kai.', null, null, 174.7440, -36.8560, 2, 'Mains NZ$32–44', 'Hāngī Sundays'),
  ('auckland', 'Viaduct',        'quayside-social',       'bar',        null, 'Quayside Social',  'Viaduct',  'A harbourside pub with a long craft beer list.', null, null, 174.7590, -36.8440, 2, 'Pints NZ$13–15', null),
  ('auckland', 'Waiheke Island', 'waiheke-vineyards',     'attraction', 'Wine region', 'Waiheke Island vineyards', 'Waiheke Island', 'Olive groves and Bordeaux-style reds, a 40-minute ferry ride away.', 'Dec–Mar', 'Fullers ferry from Auckland Downtown, then the island bus.', 175.0850, -36.7900, 2, 'Ferry return NZ$60', null),
  ('auckland', 'Auckland CBD',   'britomart-station',     'station',    null, 'Britomart Station', 'Auckland CBD', 'Auckland’s downtown rail terminus, next to the ferry building.', null, null, 174.7676, -36.8443, null, 'AT HOP or contactless', null)
) as v(city, hood, slug, type, category, name, area, descr, best, access, lng, lat, price, price_note, hours_note)
join public.cities c on c.slug = v.city
left join public.neighbourhoods n on n.city_id = c.id and n.name = v.hood;

-- Opening hours. weekday 0 = Sunday; close < open = closes after midnight.
insert into public.place_hours (place_id, weekday, open_time, close_time)
select p.id, d.wd, v.open_t::time, v.close_t::time
from (values
  ('sydney-opera-house',      '{0,1,2,3,4,5,6}', '09:00', '17:00'),
  ('royal-botanic-garden',    '{0,1,2,3,4,5,6}', '07:00', '17:30'),
  ('art-gallery-of-nsw',      '{0,1,2,4,5,6}',   '10:00', '17:00'),
  ('art-gallery-of-nsw',      '{3}',             '10:00', '22:00'),
  ('hyde-park-barracks',      '{0,1,2,3,4,5,6}', '10:00', '17:00'),
  ('barangaroo-reserve',      '{0,1,2,3,4,5,6}', '00:00', '24:00'),
  ('harbourline-oyster-room', '{0,2,3,4,5,6}',   '12:00', '22:00'),
  ('ash-and-ember',           '{3,4,5,6}',       '18:00', '23:00'),
  ('kin-noodle-bar',          '{0,1,2,3,4,5,6}', '11:00', '21:30'),
  ('wharf-street-trattoria',  '{0,1,2,3,4,5,6}', '12:00', '22:00'),
  ('saltbush-dining-room',    '{2,3,4,5,6}',     '17:30', '23:00'),
  ('the-lantern-room',        '{0,1,2,3,4,5,6}', '16:00', '01:00'),
  ('archive-bar',             '{2,3,4,5,6}',     '17:00', '02:00'),
  ('low-tide',                '{0,1,2,3,4,5,6}', '15:00', '23:00'),
  ('pyrmont-social',          '{0,1,2,3,4,5,6}', '12:00', '24:00'),
  ('hollow-lane',             '{0,2,3,4,5,6}',   '17:00', '01:00'),
  ('kettle-and-kiln',         '{0,1,2,3,4,5,6}', '07:00', '15:00'),
  ('kokako-kitchen',          '{0,3,4,5,6}',     '17:00', '22:00'),
  ('quayside-social',         '{0,1,2,3,4,5,6}', '11:00', '24:00')
) as v(slug, days, open_t, close_t)
join public.places p on p.slug = v.slug
cross join lateral unnest(v.days::int[]) as d(wd);

-- ---------------------------------------------------------------------------
-- Tags (interest / atmosphere) and place_tags
-- ---------------------------------------------------------------------------
insert into public.tags (slug, kind, name_i18n) values
  ('heritage',        'interest',   '{"en":"Heritage","th":"มรดก"}'),
  ('nature',          'interest',   '{"en":"Nature","th":"ธรรมชาติ"}'),
  ('art',             'interest',   '{"en":"Art","th":"ศิลปะ"}'),
  ('food-and-wine',   'interest',   '{"en":"Food & wine","th":"อาหารและไวน์"}'),
  ('rooftop',         'atmosphere', '{"en":"Rooftop","th":"รูฟท็อป"}'),
  ('waterfront',      'atmosphere', '{"en":"Waterfront","th":"ริมน้ำ"}'),
  ('hidden',          'atmosphere', '{"en":"Hidden","th":"ซ่อนตัว"}'),
  ('wine-bar',        'atmosphere', '{"en":"Wine bar","th":"ไวน์บาร์"}'),
  ('cocktail-lounge', 'atmosphere', '{"en":"Cocktail lounge","th":"ค็อกเทลเลานจ์"}');

insert into public.place_tags (place_id, tag_id)
select p.id, t.id
from (values
  ('sydney-opera-house', 'heritage'), ('hyde-park-barracks', 'heritage'), ('royal-botanic-garden', 'nature'),
  ('barangaroo-reserve', 'nature'), ('bondi-to-coogee-walk', 'nature'), ('art-gallery-of-nsw', 'art'),
  ('hosier-lane', 'art'), ('waiheke-vineyards', 'food-and-wine'),
  ('harbourline-oyster-room', 'waterfront'), ('wharf-street-trattoria', 'waterfront'), ('quayside-social', 'waterfront'),
  ('the-lantern-room', 'rooftop'), ('the-lantern-room', 'cocktail-lounge'),
  ('archive-bar', 'hidden'), ('hollow-lane', 'hidden'), ('hollow-lane', 'cocktail-lounge'),
  ('low-tide', 'wine-bar')
) as v(place, tag)
join public.places p on p.slug = v.place
join public.tags t on t.slug = v.tag;

-- ---------------------------------------------------------------------------
-- Eat & Drink: cuisines, venues, drinks
-- ---------------------------------------------------------------------------
insert into public.cuisines (slug, name_i18n) values
  ('modern-australian', '{"en":"Modern Australian","th":"ออสเตรเลียนร่วมสมัย"}'),
  ('seafood',           '{"en":"Seafood","th":"อาหารทะเล"}'),
  ('italian',           '{"en":"Italian","th":"อิตาเลียน"}'),
  ('japanese',          '{"en":"Japanese","th":"ญี่ปุ่น"}'),
  ('maori-kai',         '{"en":"Māori kai","th":"อาหารเมารี"}'),
  ('chinese',           '{"en":"Chinese","th":"จีน"}'),
  ('cafe',              '{"en":"Café","th":"คาเฟ่"}');

insert into public.venues (place_id, cuisine_id, dietary, menu_highlights_i18n, drinks_i18n, booking)
select p.id, c.id, v.dietary::text[], jsonb_build_object('en', v.menu), jsonb_build_object('en', v.drinks), v.booking
from (values
  ('saltbush-dining-room',    'modern-australian', '{vegetarian}',   'Wattleseed sourdough · kangaroo tartare, bush tomato · Murray cod, saltbush butter · finger-lime pavlova', 'Davidson plum spritz · Hunter Valley semillon', 'recommended'),
  ('harbourline-oyster-room', 'seafood',           '{gluten_free}',  'Six rock oysters, mignonette · spanner crab linguine · whole flounder, brown butter', 'Tasmanian sparkling · Clare Valley riesling', 'required'),
  ('ash-and-ember',           'modern-australian', '{}',             '12-course menu · ember-roasted marron · dry-aged duck', 'Paired wines · non-alcoholic pairing', 'required'),
  ('kin-noodle-bar',          'chinese',           '{vegetarian}',   'Hand-pulled noodles · chilli oil wontons · smacked cucumber', 'Jasmine tea · Tsingtao', 'walk_in'),
  ('wharf-street-trattoria',  'italian',           '{vegetarian}',   'Fresh pasta · cacio e pepe · tiramisu', 'Negroni · Chianti by the glass', 'recommended'),
  ('kettle-and-kiln',         'cafe',              '{vegan,vegetarian}', 'Crumpets, honeycomb butter · miso mushrooms · ricotta hotcakes', 'Single-origin batch brew · turmeric tonic', 'walk_in'),
  ('kokako-kitchen',          'maori-kai',         '{gluten_free}',  'Hāngī pork, kūmara · rēwena bread · kawakawa ice cream', 'Horopito gin sour · Waiheke rosé', 'recommended'),
  ('hollow-lane',             null,                '{}',             'Bar snacks: anchovy toast, fries with saltbush', 'Wattleseed old fashioned · finger-lime gimlet', 'walk_in'),
  ('the-lantern-room',        null,                '{}',             'Oysters · prawn rolls · cheese plates', 'Harbour negroni · yuzu highball', 'recommended'),
  ('archive-bar',             null,                '{}',             'Cheese and charcuterie', 'Whisky flights · house old fashioned', 'walk_in'),
  ('low-tide',                null,                '{vegetarian}',   'Tinned sardines · burrata, stone fruit', 'Skin-contact chenin · Adelaide Hills pét-nat', 'walk_in'),
  ('pyrmont-social',          null,                '{}',             'Pub classics · chicken schnitzel', 'NSW craft beer on tap', 'walk_in'),
  ('quayside-social',         null,                '{}',             'Fish and chips · pork belly bao', 'Hazy IPA on tap · local cider', 'walk_in')
) as v(place, cuisine, dietary, menu, drinks, booking)
join public.places p on p.slug = v.place
left join public.cuisines c on c.slug = v.cuisine;

insert into public.venue_drinks (place_id, drink)
select p.id, v.drink
from (values
  ('saltbush-dining-room', 'wine'), ('saltbush-dining-room', 'cocktails'),
  ('harbourline-oyster-room', 'wine'), ('ash-and-ember', 'wine'), ('ash-and-ember', 'non_alc'),
  ('wharf-street-trattoria', 'wine'), ('kettle-and-kiln', 'coffee'), ('kettle-and-kiln', 'non_alc'),
  ('kokako-kitchen', 'cocktails'), ('kokako-kitchen', 'wine'),
  ('hollow-lane', 'cocktails'), ('the-lantern-room', 'cocktails'), ('archive-bar', 'cocktails'),
  ('low-tide', 'wine'), ('pyrmont-social', 'beer'), ('quayside-social', 'beer')
) as v(place, drink)
join public.places p on p.slug = v.place;

-- Home "October edit: where to eat & drink now"
insert into public.collections (id, slug, kind, placement, title_i18n, sub_i18n, status) values
  ('b0000000-0000-0000-0000-000000000001', 'october-edit', 'venue', 'home_dining',
   '{"en":"Where to eat & drink now"}', '{"en":"October edit"}', 'published');
insert into public.collection_items (collection_id, entity_id, position)
select 'b0000000-0000-0000-0000-000000000001', p.id, v.pos
from (values ('saltbush-dining-room', 1), ('hollow-lane', 2), ('harbourline-oyster-room', 3), ('kokako-kitchen', 4)) as v(slug, pos)
join public.places p on p.slug = v.slug;

-- ---------------------------------------------------------------------------
-- Transit: agencies, cards, a few stops, place_stop_links
-- ---------------------------------------------------------------------------
insert into public.transit_agencies (country, name, website) values
  ('AU', 'Transport for NSW',          'https://transportnsw.info'),
  ('AU', 'Public Transport Victoria',  'https://www.ptv.vic.gov.au'),
  ('NZ', 'Auckland Transport',         'https://at.govt.nz');

insert into public.transit_cards (city_id, name, contactless, how_to_i18n, official_url)
select c.id, v.name, v.contactless, jsonb_build_object('en', v.how), v.url
from (values
  ('sydney',    'Opal',   true,  'Tap on and off with an Opal card or a contactless bank card.', 'https://transportnsw.info/tickets-opal'),
  ('melbourne', 'myki',   false, 'Buy a myki card at a station and touch on and off.',           'https://www.ptv.vic.gov.au/tickets/myki'),
  ('auckland',  'AT HOP', true,  'Tag on and off with AT HOP or a contactless bank card.',        'https://at.govt.nz/bus-train-ferry/at-hop-card')
) as v(city, name, contactless, how, url)
join public.cities c on c.slug = v.city;

update public.transit_agencies a set card_id = k.id
from public.transit_cards k
where (a.name, k.name) in (('Transport for NSW', 'Opal'), ('Public Transport Victoria', 'myki'), ('Auckland Transport', 'AT HOP'));

insert into public.transit_stops (agency_id, gtfs_stop_id, name, geom, step_free)
select a.id, v.gtfs, v.name, format('SRID=4326;POINT(%s %s)', v.lng, v.lat)::extensions.geography, true
from (values
  ('Transport for NSW',         'seed-cq',  'Circular Quay Station',   151.2108, -33.8615),
  ('Transport for NSW',         'seed-wy',  'Wynyard Station',         151.2057, -33.8658),
  ('Transport for NSW',         'seed-mp',  'Martin Place Station',    151.2113, -33.8679),
  ('Transport for NSW',         'seed-th',  'Town Hall Station',       151.2067, -33.8732),
  ('Transport for NSW',         'seed-ce',  'Central Station',         151.2065, -33.8830),
  ('Transport for NSW',         'seed-kx',  'Kings Cross Station',     151.2222, -33.8752),
  ('Public Transport Victoria', 'seed-fss', 'Flinders Street Station', 144.9671, -37.8183),
  ('Auckland Transport',        'seed-bm',  'Britomart Station',       174.7676, -36.8443)
) as v(agency, gtfs, name, lng, lat)
join public.transit_agencies a on a.name = v.agency;

insert into public.place_stop_links (place_id, stop_id, rank, walk_min)
select p.id, s.id, 1, v.walk
from (values
  ('sydney-opera-house', 'seed-cq', 7), ('royal-botanic-garden', 'seed-cq', 6), ('art-gallery-of-nsw', 'seed-mp', 12),
  ('hyde-park-barracks', 'seed-mp', 5), ('barangaroo-reserve', 'seed-wy', 10),
  ('harbourline-oyster-room', 'seed-cq', 6), ('ash-and-ember', 'seed-mp', 3), ('kin-noodle-bar', 'seed-ce', 6),
  ('wharf-street-trattoria', 'seed-kx', 9), ('saltbush-dining-room', 'seed-ce', 11),
  ('the-lantern-room', 'seed-wy', 4), ('archive-bar', 'seed-th', 5), ('low-tide', 'seed-kx', 4), ('pyrmont-social', 'seed-th', 14),
  ('hosier-lane', 'seed-fss', 3), ('hollow-lane', 'seed-fss', 4),
  ('quayside-social', 'seed-bm', 6)
) as v(place, stop, walk)
join public.places p on p.slug = v.place
join public.transit_stops s on s.gtfs_stop_id = v.stop;

-- ---------------------------------------------------------------------------
-- Home: hero slides, journeys, route showcase
-- ---------------------------------------------------------------------------
insert into public.hero_slides (media_id, caption_i18n, place_id, sort) values
  ('a0000000-0000-0000-0000-000000000001', '{"en":"Milford Sound, Fiordland"}',      null, 1),
  ('a0000000-0000-0000-0000-000000000002', '{"en":"Sydney Harbour at first light"}', (select id from public.places where slug = 'sydney-opera-house'), 2),
  ('a0000000-0000-0000-0000-000000000003', '{"en":"Cradle Mountain, Tasmania"}',     null, 3),
  ('a0000000-0000-0000-0000-000000000004', '{"en":"Lake Wakatipu, Queenstown"}',     null, 4);

insert into public.journeys (id, slug, kind, country, title_i18n, line_i18n, from_name, to_name, days, price_from, currency, modes, status) values
  ('c0000000-0000-0000-0000-000000000001', 'coast-to-coast-by-rail', 'itinerary', 'AU',
   '{"en":"10 days, coast to coast by rail"}',
   '{"en":"Three nights on the Indian Pacific with stops in Broken Hill and Adelaide, then four days in Fremantle."}',
   'Sydney', 'Perth', 10, 6480, 'AUD', '{train}', 'published'),
  ('c0000000-0000-0000-0000-000000000002', 'length-of-aotearoa', 'itinerary', 'NZ',
   '{"en":"12 days, the length of Aotearoa"}',
   '{"en":"Northern Explorer to Wellington, the Interislander to Picton, Coastal Pacific to Christchurch, then over the Alps."}',
   'Auckland', 'Greymouth', 12, 5920, 'NZD', '{train,ferry}', 'published'),
  ('c0000000-0000-0000-0000-000000000003', 'melbourne-and-the-wine-valleys', 'itinerary', 'AU',
   '{"en":"7 days, Melbourne and the wine valleys"}',
   '{"en":"City laneways by tram, the Yarra Valley by day, and the bay crossing from Queenscliff to the Mornington Peninsula."}',
   'Melbourne', 'Sorrento', 7, 3240, 'AUD', '{tram,train,ferry}', 'published'),
  ('c0000000-0000-0000-0000-000000000004', 'melbourne-to-sorrento-car-free', 'route_showcase', 'AU',
   '{"en":"Melbourne → Sorrento, without a car"}', '{"en":"Pay with myki · Ferry ticket separate"}',
   'Melbourne', 'Sorrento', 1, 18, 'AUD', '{train,bus,ferry}', 'published');

insert into public.journey_legs (journey_id, seq, day, mode, from_name, to_name, operator, duration_min, frequency_text) values
  ('c0000000-0000-0000-0000-000000000004', 1, 1, 'train', 'Southern Cross', 'Geelong',     'V/Line',   65, null),
  ('c0000000-0000-0000-0000-000000000004', 2, 1, 'bus',   'Geelong',        'Queenscliff', 'Route 75', 40, null),
  ('c0000000-0000-0000-0000-000000000004', 3, 1, 'ferry', 'Queenscliff',    'Sorrento',    'Searoad',  40, 'Hourly');

-- ---------------------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------------------
insert into public.gallery_photos (media_id, place_id, region_id, season, title_i18n, sort, status)
select v.media::uuid, p.id, r.id, v.season::public.season, jsonb_build_object('en', v.title), v.sort, 'published'
from (values
  ('a0000000-0000-0000-0000-000000000011', 'bondi-to-coogee-walk', 'sydney',    'summer', 'Bondi to Coogee coastal walk', 1),
  ('a0000000-0000-0000-0000-000000000012', 'sydney-opera-house',   'sydney',    'spring', 'Sydney Opera House',           2),
  ('a0000000-0000-0000-0000-000000000015', 'royal-botanic-garden', 'sydney',    'spring', 'Royal Botanic Garden',         3),
  ('a0000000-0000-0000-0000-000000000013', 'hosier-lane',          'melbourne', 'autumn', 'Hosier Lane at dusk',          4),
  ('a0000000-0000-0000-0000-000000000014', 'waiheke-vineyards',    'auckland',  'summer', 'Waiheke Island vineyards',     5)
) as v(media, place, region, season, title, sort)
join public.places p on p.slug = v.place
join public.regions r on r.slug = v.region;

insert into public.place_nearby_venues (place_id, venue_id, sort)
select p.id, q.id, v.sort
from (values
  ('bondi-to-coogee-walk', 'saltbush-dining-room', 1), ('bondi-to-coogee-walk', 'low-tide', 2),
  ('sydney-opera-house', 'harbourline-oyster-room', 1), ('sydney-opera-house', 'wharf-street-trattoria', 2),
  ('hosier-lane', 'hollow-lane', 1)
) as v(place, venue, sort)
join public.places p on p.slug = v.place
join public.places q on q.slug = v.venue;

-- ---------------------------------------------------------------------------
-- Money: one FX snapshot (base AUD), 30 days of fx_daily, cost items, budgets
-- ---------------------------------------------------------------------------
insert into public.fx_snapshots (fetched_at, base, rates, source) values
  ('2026-10-14 22:30Z', 'AUD',
   '{"AUD":1,"NZD":1.127,"THB":21.48,"USD":0.6582,"EUR":0.5664,"GBP":0.4921,"JPY":98.62,"SGD":0.8507,"CNY":4.6935}',
   'seed-placeholder');

-- Deterministic wiggle around the snapshot rates (placeholder history for the chart).
insert into public.fx_daily (day, quote, close)
select d::date, q.code,
       round((q.rate * (1 + 0.011 * sin(i * 0.37 + 1.3) + 0.004 * sin(i * 1.17)))::numeric, 8)
from generate_series(date '2026-09-15', date '2026-10-14', interval '1 day') with ordinality as g(d, i)
cross join (values ('NZD', 1.127), ('THB', 21.48), ('USD', 0.6582), ('EUR', 0.5664), ('GBP', 0.4921),
                   ('JPY', 98.62), ('SGD', 0.8507), ('CNY', 4.6935)) as q(code, rate);

insert into public.cost_reference_items (item_i18n, note_i18n, aud, nzd, verified_at, sort) values
  ('{"en":"Flat white"}',             '{"en":"Café, regular size"}',                         5.20,   5.50, '2026-10-15', 1),
  ('{"en":"Meat pie"}',               '{"en":"Bakery, takeaway"}',                           6.50,   6.00, '2026-10-15', 2),
  ('{"en":"Casual lunch"}',           '{"en":"Café main and drink"}',                       28.00,  30.00, '2026-10-15', 3),
  ('{"en":"Dinner for two"}',         '{"en":"Mid-range, with wine"}',                     160.00, 170.00, '2026-10-15', 4),
  ('{"en":"Metro or tram ride"}',     '{"en":"Single trip, card fare"}',                     4.20,   3.50, '2026-10-15', 5),
  ('{"en":"Regional train"}',         '{"en":"e.g. Sydney–Katoomba, Auckland–Hamilton"}',    9.50,  65.00, '2026-10-15', 6),
  ('{"en":"Hotel night, mid-range"}', '{"en":"Double room, city centre"}',                 260.00, 240.00, '2026-10-15', 7),
  ('{"en":"Hotel night, premium"}',   '{"en":"Five-star, city centre"}',                   620.00, 560.00, '2026-10-15', 8);

insert into public.budget_presets (country, style, per_day, note_i18n) values
  ('AU', 'budget',      220, '{"en":"Simple hotels, casual meals, public transport."}'),
  ('AU', 'comfortable', 420, '{"en":"Boutique stays, one good dinner a day, a tour or two."}'),
  ('AU', 'luxury',      850, '{"en":"Five-star stays, fine dining, private experiences."}'),
  ('NZ', 'budget',      200, '{"en":"Simple hotels, casual meals, public transport."}'),
  ('NZ', 'comfortable', 380, '{"en":"Boutique stays, one good dinner a day, a tour or two."}'),
  ('NZ', 'luxury',      760, '{"en":"Five-star stays, fine dining, private experiences."}');

-- ---------------------------------------------------------------------------
-- Visa & Entry. Indicative placeholder mapping only: must be verified against
-- official sources before launch (verified_at null everywhere).
-- ---------------------------------------------------------------------------
insert into public.official_links (country, agency, title_i18n, url) values
  ('AU', 'Department of Home Affairs', '{"en":"Department of Home Affairs"}',  'https://immi.homeaffairs.gov.au'),
  ('NZ', 'Immigration New Zealand',    '{"en":"Immigration New Zealand"}',     'https://www.immigration.govt.nz'),
  ('NZ', 'Immigration New Zealand',    '{"en":"NZeTA, official information"}', 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/nzeta');

insert into public.permission_types (country, slug, name_i18n, plain_i18n, who_i18n, how_i18n,
                                     processing_text, fee_text, validity_text, good_i18n, official_link_id)
select v.country::public.country_code, v.slug, jsonb_build_object('en', v.name), jsonb_build_object('en', v.plain),
       jsonb_build_object('en', v.who), jsonb_build_object('en', v.how), v.processing, v.fee, v.validity,
       jsonb_build_object('en', v.good), l.id
from (values
  ('AU', 'au-eta', 'Electronic Travel Authority (ETA)',
   'A digital permission linked to your passport, applied for through the official Australian ETA app.',
   'Eligible passport holders visiting for tourism or business visits.', 'Official Australian ETA app',
   'Often within 1–2 days', 'A$20 service fee', 'Up to 12 months, stays up to 3 months each',
   'The app scans your passport chip, so apply on your own phone.', 'https://immi.homeaffairs.gov.au'),
  ('AU', 'au-evisitor', 'eVisitor',
   'A free online visitor permission for some passport holders, applied for on the Department of Home Affairs website.',
   'Passport holders of eligible European countries.', 'Online, via ImmiAccount',
   'Often within a few days', 'Free', 'Up to 12 months, stays up to 3 months each',
   'Apply with the same passport you will travel on.', 'https://immi.homeaffairs.gov.au'),
  ('AU', 'au-visitor-visa', 'Visitor visa (Australia)',
   'An online visitor visa application through ImmiAccount on the Department of Home Affairs website. Allow extra time for processing.',
   'Travellers who are not eligible for the ETA or eVisitor.', 'Online, via ImmiAccount',
   'Several weeks; varies', 'A$190–200', 'Set by the grant letter',
   'Apply well before booking non-refundable travel.', 'https://immi.homeaffairs.gov.au'),
  ('NZ', 'nzeta', 'NZeTA',
   'A New Zealand Electronic Travel Authority, applied for in the official NZeTA app or on Immigration New Zealand’s website. A tourism levy is usually paid at the same time.',
   'Visa-waiver passport holders and some transit passengers.', 'Official NZeTA app or website',
   'Allow up to 72 hours', 'NZ$17–23', 'Up to 2 years',
   'Usually paid together with the tourism levy.', 'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/nzeta'),
  ('NZ', 'nz-visitor-visa', 'Visitor visa (New Zealand)',
   'An online visitor visa application through Immigration New Zealand. Allow extra time for processing.',
   'Travellers who need a visa to visit New Zealand.', 'Online, Immigration New Zealand',
   'Several weeks; varies', 'NZ$340–400', 'Set by the visa conditions',
   'Check whether the tourism levy is included.', 'https://www.immigration.govt.nz'),
  ('NZ', 'nz-ivl', 'Tourism levy (IVL)',
   'The International Visitor Conservation and Tourism Levy, paid with your NZeTA or visa.',
   'Most visitors arriving with an NZeTA or visitor visa.', 'Paid with your NZeTA or visa',
   'Paid at application', 'NZ$100', 'Matches your NZeTA or visa',
   'Supports conservation and tourism infrastructure.', 'https://www.immigration.govt.nz')
) as v(country, slug, name, plain, who, how, processing, fee, validity, good, url)
join public.official_links l on l.url = v.url;

-- nationality -> (AU permission, NZ permission), tourism, stays up to 3 months
insert into public.entry_rules (nationality, country, purpose, stay, permission_id)
select v.nat, x.country::public.country_code, 'tourism', s.stay, pt.id
from (values
  ('TH', 'au-visitor-visa', 'nz-visitor-visa'),
  ('CN', 'au-visitor-visa', 'nz-visitor-visa'),
  ('SG', 'au-eta',          'nzeta'),
  ('JP', 'au-eta',          'nzeta'),
  ('US', 'au-eta',          'nzeta'),
  ('GB', 'au-evisitor',     'nzeta')
) as v(nat, au, nz)
cross join lateral (values ('AU', v.au), ('NZ', v.nz)) as x(country, permission)
cross join (values ('lt1'), ('1to3')) as s(stay)
join public.permission_types pt on pt.slug = x.permission;

insert into public.entry_documents (slug, title_i18n, note_i18n, sort) values
  ('passport',  '{"en":"Passport validity"}',        '{"en":"Check the minimum validity required on the official site, counted from your arrival or departure date."}', 1),
  ('photo',     '{"en":"Digital passport photo"}',   '{"en":"Recent, plain background, meeting the official photo guidelines."}', 2),
  ('funds',     '{"en":"Proof of funds"}',           '{"en":"Recent bank statements showing you can support your stay."}', 3),
  ('ticket',    '{"en":"Return or onward ticket"}',  '{"en":"A booking that shows you will leave within your permitted stay."}', 4),
  ('stay',      '{"en":"Accommodation details"}',    '{"en":"Hotel bookings or the address of friends or family."}', 5),
  ('insurance', '{"en":"Travel insurance"}',         '{"en":"Strongly recommended, including medical cover."}', 6),
  ('itinerary', '{"en":"Travel itinerary"}',         '{"en":"A simple day-by-day outline of where you will be."}', 7);

insert into public.faqs (scope, q_i18n, a_i18n, sort) values
  ('visa', '{"en":"Can I work or study on this?"}',
   '{"en":"Visitor permissions are generally for tourism and short business visits. Work and study usually need a different visa. Check the official site for what is allowed."}', 1),
  ('visa', '{"en":"Can I visit both countries on one trip?"}',
   '{"en":"Yes, many travellers do. Australia and New Zealand issue separate permissions, so you will usually need one for each country."}', 2),
  ('visa', '{"en":"What if my passport is renewed?"}',
   '{"en":"Electronic permissions are linked to a specific passport. If you get a new passport, check whether you need to apply again or update your details on the official site."}', 3),
  ('visa', '{"en":"What if I am only transiting?"}',
   '{"en":"Transit rules depend on your nationality, airport and how long you stay airside. Check the transit section of each official site before you fly."}', 4),
  ('visa', '{"en":"What if the application is refused?"}',
   '{"en":"The decision letter usually explains why. Read it carefully and follow the official guidance. Be cautious of anyone offering a guaranteed fix for a fee."}', 5);

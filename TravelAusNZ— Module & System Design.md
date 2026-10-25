# TravelAusNZ — Module & System Design

Oct 24, 2026 · @EarthStrix

## 1. Overview

TravelAusNZ เป็นเว็บแนะนำเที่ยว Australia + New Zealand สำหรับนักท่องเที่ยวอิสระ (28–55 ปี, ทริป 1–3 สัปดาห์, ส่วนใหญ่ไม่ขับรถ) ระบบออกแบบเป็น **content-heavy, read-mostly** — 95% ของ traffic เป็นการอ่าน จึงเน้น SSG/ISR + cache หนัก และเขียนลง DB เฉพาะ user data (saved items, checklist, trip)

**Tech stack**

| Layer | เลือกใช้ | เหตุผล |
| --- | --- | --- |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind | SSG/ISR ต่อหน้า, i18n routing, SEO |
| Hosting | Vercel (Edge + Serverless) | ISR, Edge cache, Cron |
| Database | Supabase Postgres 16 + PostGIS + pg\_trgm | geo query ของแผนที่, full-text ไทย/อังกฤษ |
| Auth | Supabase Auth (Email magic link, Google, Apple) | RLS ผูกกับ `auth.uid()` |
| Storage | Supabase Storage + image CDN (Vercel Image) | รูปสถานที่/อาหาร |
| Map | MapLibre GL + vector tiles (MapTiler/Protomaps) | ราคาถูกกว่า Google Maps, style คุมได้ตาม 3 สี |
| Cache | Vercel Data Cache + Upstash Redis | rate cache, rate limit |
| Jobs | Vercel Cron + Supabase Edge Functions | ดึง FX rate, ตรวจลิงก์ visa, sync GTFS |
| CMS | Admin panel ภายใน (Next.js `/admin`) บน Supabase | ไม่ต้องจ่าย headless CMS แยก |
| Observability | Sentry + Vercel Analytics + PostHog | error, web vitals, funnel |

สถาปัตยกรรมรวม: browser → Vercel Edge (ISR pages + Route Handlers `/api/v1/*`) → Supabase (Postgres/Auth/Storage) โดยมี Cron jobs ดึงข้อมูลภายนอก (FX, GTFS, link check) เข้า DB ล่วงหน้า หน้าเว็บจึง**ไม่เรียก API ภายนอกตอน request เลย** (ดูแผนภาพด้านล่าง)

&#91;embedded content: System architecture · 3 layers + external sources\]

ข้อยกเว้นเดียวคือ journey planner ที่ Route Handler เรียก OpenTripPlanner (self-host, private network) แบบ cache 15 นาที ส่วนเส้นทางอื่นที่แตะโลกภายนอกคือ Cron (ดึงเข้า) กับ map tiles (browser โหลดตรง) ส่วน request ของผู้ใช้ทุกตัวจบใน Vercel + Data layer

## 2. Page map (จาก Claude Design: TravelAusNZ)

ไฟล์ Design มี 10 หน้าหลัก แบ่งเป็น 3 กลุ่มตาม nav: **Explore** (Destinations, Map, Transport, Eat & Drink, Gallery), **Plan** (Visa & Entry, Money, Prepare) และ **My Trip** ทุกหน้ามี light/dark + mobile 390 px และหลายหน้ามี loading / error / empty state ที่ backend ต้องรองรับ

| # | หน้า (route) | Module หลัก | Render | ต้อง login | State ที่ต้องรองรับ |
| --- | --- | --- | --- | --- | --- |
| 1 | Destinations `/` | `content`, `journeys`, `venues` | SSG + ISR | ไม่ | hero 4 สไลด์, สลับ AU/NZ |
| 2 | Map `/map` | `places`, `transit` | client + cached API | ไม่ (save ต้อง) | layer on/off, place drawer, city/overview |
| 3 | Transport `/transport` | `transit`, `routing` | client + API | ไม่ | 3 ตัวเลือกเส้นทาง, step-free filter, no result |
| 4 | Eat & Drink `/eat-drink` | `venues` | SSG + client filter | ไม่ | tab ร้าน/บาร์, filter 6 ชุด, detail drawer |
| 5 | Gallery `/gallery` | `media`, `places` | SSG + client filter | ไม่ | filter 3 ชุด, lightbox, empty |
| 6 | Signature Dishes `/dishes`, `/dishes/[slug]` | `dishes`, `venues` | SSG + ISR | ไม่ | must-try, collections, filter sheet (mobile), empty |
| 7 | Money `/money` | `fx` | SSG shell + client | ไม่ | loading, error (ใช้ rate ล่าสุดที่บันทึก), สลับสกุลบ้าน |
| 8 | Visa & Entry `/visa` | `entry` | SSG + client | ไม่ | helper empty / loading / result, mobile step 1–3 |
| 9 | Prepare `/prepare` | `prepare`, `trip` | SSG + client | ไม่ (sync ต้อง) | checklist เก็บในเครื่อง → sync เมื่อ login |
| 10 | My Trip `/trip/[id]` | `trip`, `routing` | dynamic | ใช่ (guest ใช้ local) | day tabs, off-map day, share read-only |

**ตัวนับ "My Trip · N"** ใน nav ทุกหน้าอ่านจาก `GET /api/v1/me/summary` (จำนวน saved + trip ล่าสุด) หรือจาก localStorage เมื่อเป็น guest

## 3. Shared modules

ทุกหน้าประกอบจาก 12 module ชุดเดียว — `places`, `venues`, `dishes` ใช้ตาราง `places` ร่วมกัน (ร้าน/บาร์คือ place ที่มีข้อมูลเสริม) และทุก entity มี **nearest stop** เพราะแนวคิดหลักของเว็บคือ *car-free*

| Module | หน้าที่ | ใช้ในหน้า |
| --- | --- | --- |
| `core-auth` | Supabase Auth (magic link, Google, Apple), `profiles` (locale, home\_currency, theme) | ทุกหน้า |
| `core-content` | regions, cities, tags, i18n jsonb, editorial status | ทุกหน้า |
| `media` | รูป + ratio + credit/license, ผูก place/dish/region | Gallery, Home, Dishes |
| `places` | attraction/landmark, เวลาเปิด, ราคา, nearest stop + เวลาเดิน | Map, Gallery, Trip |
| `venues` | ร้าน/บาร์/คาเฟ่ (ต่อยอด `places`): cuisine, price level, menu highlights, drinks, atmosphere, dietary | Eat & Drink, Home, Dishes |
| `dishes` | dish catalog, collections, where-to-try | Dishes |
| `transit` | agencies, lines, stops, shapes (GTFS), transit cards, scenic routes | Map, Transport, Prepare |
| `routing` | journey planner A→B (legs, fare, card, step-free) | Transport, Trip, Home widget |
| `journeys` | curated itineraries (หลายวัน, mode, ราคาเริ่มต้น) | Home |
| `fx` | rates, cross rate, history, cost reference, budget presets | Money, Trip budget |
| `entry` | permission types + indicative rules ต่อสัญชาติ, official links, freshness | Visa |
| `trip` | saved items, trip days, stops, legs, checklist, share | My Trip, Prepare, ทุกปุ่ม save |

**Guest-first state.** การ save, checklist, packing ทำงานได้ทันทีโดยไม่ login (localStorage key `tanz:v1:*`) เมื่อ login จะเรียก `POST /api/v1/me/merge` ครั้งเดียวเพื่อย้ายข้อมูลเข้า DB แล้วใช้ DB เป็น source of truth

**i18n.** ข้อความ content เก็บ `*_i18n jsonb` (`{"en":..,"th":..}`) ส่วน UI string ใช้ next-intl; ราคาแสดงเป็นสกุลท้องถิ่น (A$ / NZ$) เสมอ และแปลงเป็นสกุลบ้านผ่าน `fx` เมื่อผู้ใช้เปิด

**API conventions.** REST `/api/v1`, Zod validate, cursor pagination, error `{error:{code,message}}`, rate limit (Upstash) เฉพาะ write + search + routing; ทุก list endpoint รับ `locale`

**Caching.** Content = ISR + `revalidateTag` เมื่อ admin publish · FX = Edge 1 ชม. · routing = Redis 15 นาที (key = from/to/ปัดเวลา 15 นาที) · user data = `no-store`

## 4. Destinations (Home)

หน้าแรกเป็น editorial ล้วน ("Edited, not aggregated") จึง render แบบ SSG ทั้งหน้าจาก DB และ revalidate เมื่อ editor publish — interaction เดียวที่เรียก API คือช่องค้นหาและ newsletter

| Section ใน Design | ข้อมูล | Source |
| --- | --- | --- |
| Hero slider 4 ภาพ + caption สถานที่ | `hero_slides` (media + place + sort) | SSG |
| ค้นหา Where / When / Interests | regions, เดือน, tags | `GET /api/v1/search` |
| Featured regions (สลับ AU / NZ): ภาพใหญ่ 1 + กว้าง 1 + เล็ก n, "Best Sep–Nov" | `regions` (`best_months`, `lede_i18n`, cover) | SSG |
| Curated journeys: country · modes, จาก→ถึง, "From A$… pp" | `journeys` | SSG |
| Car-free widget: Melbourne → Sorrento, legs Train/Bus/Ferry, เวลา, ค่าโดยสาร, "Pay with myki" | `journeys` ที่ `kind='route_showcase'` + `journey_legs` | SSG |
| October edit: Where to eat & drink now | `collections` ที่ `placement='home_dining'` → venues | SSG |
| Dispatch newsletter | `newsletter_subscribers` | `POST /api/v1/newsletter` |
| Footer: Acknowledgement of Country | static i18n | — |

**API**

| Method + Path | Body / Query | Response |
| --- | --- | --- |
| `GET /api/v1/home?country=au\|nz` | `locale` | slides, regions, journeys, route showcase, dining edit (ใช้ตอน build) |
| `GET /api/v1/journeys` | `country`, `mode[]`, `cursor` | journey cards |
| `GET /api/v1/journeys/:slug` | `locale` | journey + days + legs |
| `POST /api/v1/newsletter` | `{ email, locale }` | 202 + ส่ง double opt-in email |

**Tables:** `hero_slides`, `regions`, `journeys`, `journey_legs`, `collections`, `collection_items`, `newsletter_subscribers`

## 5. Interactive Map

แผนที่มี 2 ระดับตาม Design: **overview** (ทั้งประเทศ, จุด cluster เป็นตัวเลขต่อย่าน) และ **city** (จุดรายสถานที่ + เส้นรถไฟ/สถานี) เลือกจุดแล้วเปิด drawer ที่บอก nearest stop + เวลาเดิน และวาดเส้นทางเดินบนแผนที่

| Component | ข้อมูล | หมายเหตุ |
| --- | --- | --- |
| `MapCanvas` (MapLibre) | `/api/v1/map/places?bbox`, `/api/v1/map/transit?city` | lazy-load, tile CDN |
| `ClusterBadge` (เช่น Glebe 11, Paddington 12) | `places` group by `neighbourhood` | คำนวณฝั่ง server ตอน zoom < 13 |
| `LayerToggle` Attraction / Restaurant / Bar / Transport + count | count จาก response | แยกด้วย icon shape ไม่ใช้สี |
| `Breadcrumb` Australia / Sydney | `countries` → `cities` | สลับประเทศได้ |
| `PlaceDrawer` | name, type · area, desc, tags, hours + note, price level + note, nearest stop, walk | `GET /api/v1/places/:slug` |
| `WalkRoute` | polyline place → stop | เก็บไว้ใน `place_stop_links.walk_geom` (คำนวณล่วงหน้า) |
| `AddToTrip` | `trip` | guest → local, login → DB |

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/map/places` | `bbox`, `zoom`, `types[]` | zoom < 13 → clusters; ≥ 13 → GeoJSON ≤ 500 จุด + counts per type | 10 นาที |
| `GET /api/v1/map/transit` | `city_id`, `modes[]` | lines (shape) + stations | 24 ชม. |
| `GET /api/v1/places/:slug` | `locale` | detail + nearest stops (≤ 3) + walk geometry | ISR |

**Key query:** `places` + `place_stop_links` (precomputed: stop ที่ใกล้ที่สุด 3 จุด ภายใน 1.2 km, เวลาเดินจาก OSRM foot profile) → drawer ไม่ต้องคำนวณตอน request

**Tables:** `places`, `place_hours`, `place_tags`, `place_stop_links`, `neighbourhoods`, `transit_stops`, `transit_lines`

## 6. Gallery

ทุกรูปใน Gallery ผูกกับ place หนึ่งแห่ง lightbox จึงดึง "Best time to visit / How to get there / Nearby dining" จาก place นั้น ไม่ได้เก็บข้อความซ้ำที่รูป

| Component | ข้อมูล |
| --- | --- |
| Filter Region (8) · Type (Beach, Mountain, City, Wildlife, Wine region, Heritage) · Season (4) | `gallery_photos.region_id`, `places.category`, `gallery_photos.season` |
| Masonry grid ตาม aspect ratio (4/5, 3/2, 2/3, 16/9) | `media_assets.width/height` |
| Lightbox: title, desc, best time, how to get there (car-free), nearby dining, "Open attraction page", "Add to trip" | `places.best_time_i18n`, `places.access_i18n`, `place_nearby_venues` |
| Prev / Next + "n / total" | ลำดับตามผลกรอง |
| Empty: "Nothing matches every filter" | client |

**API:** `GET /api/v1/gallery?region=&type=&season=&cursor=` → photos + place summary (ISR, tag `gallery`); lightbox ใช้ข้อมูลที่มากับ list แล้ว ไม่ยิงซ้ำ

**Tables:** `gallery_photos`, `media_assets`, `places`, `place_nearby_venues`

**Media rules:** เก็บต้นฉบับใน Storage, serve ผ่าน image CDN เป็น AVIF/WebP 3 ขนาด (480 / 960 / 1920) + blurhash สำหรับ placeholder; `license` และ `credit` บังคับกรอกก่อน publish

## 7. Transport

หน้านี้ต้องการ journey planner จริง (A → B, เวลาออก, 3 ตัวเลือก, legs, ค่าโดยสาร, บัตรที่ใช้) จึงเป็นจุดเดียวที่ต้องมี **routing engine** แยก: self-host OpenTripPlanner 2 (OTP) บน VM ที่โหลด GTFS ของทุก agency + OSM แล้วให้ Next.js เรียกผ่าน `routing` module ที่ cache และเติมข้อมูลบัตร/ค่าโดยสารเอง

| Section ใน Design | Backend |
| --- | --- |
| From / To / Depart + Find routes | `GET /api/v1/routes/plan` → OTP GraphQL `plan` |
| Mode chips Train/Tram/Bus/Ferry + "Step-free routes only" | ส่งเป็น `transportModes`, `wheelchair=true` ให้ OTP |
| 3 options: depart–arrive, duration, summary, fare (A$5–9), card (Opal or contactless · off-peak) | OTP itineraries → `fare_rules` + `transit_cards` เติม fare range และชื่อบัตร |
| Selected route: legs (เวลา, จุด, mode, detail เช่น platform 4 · 1 h 58) | OTP legs → map ไปเป็น `{t, from, mode, detail}` |
| Route explorer by city: line, stops, time, frequency, fare | `transit_lines` + `line_stops` + `line_service_summary` (คำนวณจาก GTFS) |
| Scenic rail & ferry routes (Ghan, TranzAlpine, Interislander…) | `scenic_routes` (editorial) |
| Cards, passes & access | `transit_cards`, `content_blocks` key `transport_tips` |

**Routing flow**

1. Client ส่ง `from`, `to` (place slug หรือ lat/lng), `depart` (local time ของเมืองนั้น)
2. Route Handler แปลง slug → lat/lng, ปัดเวลา 15 นาที → ดู Redis `route:{hash}`
3. Cache miss → เรียก OTP (`numItineraries: 3`, `walkReluctance: 2`, `wheelchair`)
4. Post-process: รวม walk leg สั้นกว่า 2 นาที, ใส่ fare ตาม `fare_rules` (zone/distance/cap), ใส่บัตรตาม agency
5. เก็บ Redis 15 นาที แล้วตอบ client
6. OTP ล่ม → ตอบ `503 routing_unavailable` พร้อม curated route จาก `journeys` ที่ from/to ตรงกัน (ถ้ามี)

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/routes/plan` | `from`, `to`, `depart`, `modes[]`, `step_free` | `{ options: [{ depart, arrive, duration_min, summary, fare_min, fare_max, currency, card, legs[] }] }` | Redis 15 นาที |
| `GET /api/v1/transit/cities/:city/lines` | `mode` | lines + stops + time + freq + fare | 24 ชม. |
| `GET /api/v1/transit/scenic` | `country` | scenic routes | ISR |
| `GET /api/v1/transit/cards` | `city` | card name, how to buy, caps, official link | ISR |

**Tables:** `transit_agencies`, `transit_lines`, `transit_stops`, `line_stops`, `line_service_summary`, `fare_rules`, `transit_cards`, `scenic_routes`

**ทางเลือกถ้าไม่อยาก host OTP ใน MVP:** ใช้ Google Routes API (transit) แทนชั่วคราว — เร็วกว่าแต่มีค่าใช้จ่ายต่อ request และไม่มี fare ของ AU/NZ ครบ จึงยังต้องใช้ `fare_rules` ของเราเอง

## 8. Eat & Drink

ร้านทุกแห่ง "Visited and paid for by our editors" เป็นแถวใน `places` (type restaurant / bar / cafe) + ตารางเสริม `venues` ที่เก็บข้อมูลเฉพาะร้าน แผนที่, Dishes และ Trip จึงใช้ร้านชุดเดียวกัน

| Component | ข้อมูล |
| --- | --- |
| Tab Restaurants / Bars + count | `places.type` |
| Filter: City · Price (1–4) · Drink (wine, cocktails, beer, coffee) · Atmosphere (Waterfront, Counter, Courtyard…) · Dietary (Vegan, Vegetarian, Gluten-free…) · Cuisine (Modern Australian, Seafood, Italian, Japanese, Māori kai, Café) | `venues.price_level`, `venue_drinks`, `place_tags` kind=atmosphere, `venues.dietary[]`, `venues.cuisine_id` |
| Card: cuisine, price on/off, name, hood · city, 2 tags | list endpoint |
| Detail: desc, Menu highlights, Signature drinks, Opening hours, nearest stop + walk, Save, "On the map" | `venues.menu_highlights_i18n`, `venues.drinks_i18n`, `place_hours`, `place_stop_links` |

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/venues` | `kind=restaurant\|bar`, `city`, `price_max`, `drink`, `mood`, `diet[]`, `cuisine`, `cursor` | cards + facet counts | ISR + client filter เมื่อ ≤ 300 รายการ |
| `GET /api/v1/venues/:slug` | `locale` | detail | ISR |

เมื่อ catalog ต่อเมืองยังไม่เกิน 300 ร้าน ให้ ship JSON ทั้งเมืองไปกับหน้า (ISR) แล้วกรองฝั่ง client ทันใจกว่า query ทุกครั้ง; เกินแล้วค่อยเปลี่ยนเป็น server filter

**Tables:** `places`, `venues`, `cuisines`, `venue_drinks`, `place_tags`, `place_hours`, `place_stop_links`

## 9. Signature Dishes

หน้า dish-first ("Eat the place, not the menu"): dish เป็นศูนย์กลาง แล้วผูกกับร้านใน `places` ผ่าน `dish_venues` แยกตาม region ตามที่ Design แสดง 3 ร้านต่อภูมิภาค พร้อม nearest stop

| Component | ข้อมูล |
| --- | --- |
| Filter: Country · Region (Sydney, Melbourne, Queensland, Tasmania, NT, Auckland, Wellington, Rotorua, South Island) · Type · Price · Dietary (Vegetarian, Vegan, Gluten-free, Halal-friendly, No pork, No shellfish) | `dishes.*`, `dishes.dietary[]` |
| Must try: "If you eat only three things" | `dishes.must_try_rank` |
| All dishes: sorted by editors, card ratio ต่างกัน | `dishes.sort` + cover media |
| Collections: title, sub, count, 3 dish previews | `collections` kind=dish |
| Detail: story, "A friendly dispute" note, What it tastes like, How it's served, Dietary & allergy notes, tags, Best paired with (k/v), Where to try it (1–3 + stop), Save, Open map | `dishes.story_i18n`, `dispute_note_i18n`, `taste_i18n`, `served_i18n`, `allergy_i18n`, `dish_pairings`, `dish_venues` |
| Mobile filter bottom sheet + "Show n dishes" | facet counts จาก client |

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/dishes` | `country`, `region`, `type`, `price`, `diet[]` | dishes + must-try + collections | ISR (catalog เล็ก ส่งทั้งชุด กรองฝั่ง client) |
| `GET /api/v1/dishes/:slug` | `locale`, `region` | detail + pairings + venues ของ region นั้น (หรือใกล้สุด) | ISR |

**Tables:** `dishes`, `dish_pairings`, `dish_venues`, `collections`, `collection_items`, `places`, `place_stop_links`

**กติกา:** allergy note ต้องมีคำเตือนให้ถามร้านทุกครั้ง; ร้านที่ `is_closed` ถูกซ่อนจาก Where to try และเข้า review queue ของ editor

## 10. Money (Currency converter)

Design ใช้สกุลบ้านได้ 7 สกุล (THB, USD, EUR, GBP, JPY, SGD, CNY) แปลงเป็น AUD / NZD / ทั้งคู่ พร้อม cross rate AUD↔NZD, กราฟ 7D / 1M / 3M / 1Y, ตารางราคาอ้างอิงสองประเทศ และ budget helper — ทั้งหมดคำนวณฝั่ง client จาก rate snapshot เดียว

| Component | ข้อมูล | หมายเหตุ |
| --- | --- | --- |
| Converter: You have / You get, swap, quick chips 1,000–50,000, target AUD/NZD/Both | `GET /fx/latest?base=AUD` | ไม่มี API call ต่อการพิมพ์ |
| Rate line + "Updated …" + mid-market note | `fx_snapshots.fetched_at`, `source` |  |
| Cross rate card (Tasman crossing) | คำนวณจาก snapshot |  |
| Rate trend: pair AUD/NZD in home, range 4 แบบ, Now / Change / High / Low, hover | `GET /fx/history` | daily close |
| What things cost: item, AU price, NZ price, แปลงเป็นสกุลบ้าน | `cost_reference_items` | `verified_at` ทุกแถว |
| Budget helper: วัน 3–21 × style (Budget / Comfortable / Luxury) | `budget_presets` (ต่อวัน ต่อประเทศ) | flights not included |
| Money tips (6 ข้อ) | `content_blocks` key `money_tips` |  |
| Loading state | skeleton |  |
| Error state: "use the last saved rates from {date}" | API ตอบ snapshot ล่าสุดพร้อม `stale: true` | ไม่ตอบ error เปล่า |

**Rate ingestion:** Cron ทุกชั่วโมงดึง provider หลัก (base USD) → คำนวณเป็น base AUD ทุกสกุล + NZD → insert `fx_snapshots` (1 แถว = 1 เวลา, rates เป็น jsonb) → Redis `fx:latest`; provider ล้ม → ลอง provider สำรอง → ล้มทั้งคู่ → ไม่เขียน, API ใช้ snapshot เดิมพร้อม `stale: true` เมื่อเกิน 6 ชม.

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/fx/latest` | `base=AUD` | `{ base, rates: {NZD, THB, USD…}, fetched_at, source, stale }` | Edge 1 ชม. |
| `GET /api/v1/fx/history` | `pair=AUD-THB`, `range=7d\|1m\|3m\|1y` | `[{ day, close }]` + high/low | 6 ชม. |
| `GET /api/v1/fx/reference` | `locale` | cost items + budget presets + tips | ISR |

**Tables:** `currencies`, `fx_snapshots`, `fx_daily`, `cost_reference_items`, `budget_presets`, `content_blocks`

## 11. Visa & Entry

Design มี helper 3 คำถาม (สัญชาติ · จุดประสงค์ · ระยะเวลา) ที่แสดง permission ที่ "typically applies" แล้วพาไปเว็บรัฐบาล ระบบจึงเก็บแค่ **ตาราง mapping แบบ indicative ที่ editor ดูแล** และคำนวณผลใน browser — คำตอบของผู้ใช้ไม่ถูกส่งหรือบันทึก ("Nothing you enter here is stored or sent")

| Component | ข้อมูล |
| --- | --- |
| Country tabs AU / NZ / Both + แบนเนอร์ "Entry rules change" | static |
| Helper: nationality combobox (มี "Not listed here"), Tourism / Work-study, stay 3 ช่วง | `entry_rules` ทั้งตารางส่งมากับหน้า (ไม่กี่ร้อยแถว) |
| Result: permission name, plain explanation, extra, CTA → official domain (เปิด tab ใหม่) | `permission_types` + `official_links` |
| Work/study → ไม่ให้ผล แสดงว่าใช้ permission คนละแบบ + ลิงก์ทางการ | logic ฝั่ง client |
| Permission types explained: who, how, processing, fee, validity, good to know (ค่าที่เป็น Placeholder มีป้าย) | `permission_types` (field ไหน `verified_at` ว่าง → แสดงป้าย Placeholder) |
| Application timeline 6 ขั้น + lead time 12 / 8 / 4 สัปดาห์ | `content_blocks` key `entry_timeline` |
| Documents checklist + "n of m ready" + Print | `entry_documents`; สถานะ tick เก็บในเครื่อง / Trip checklist |
| Scams & safety + วิธีดู official domain (.gov.au / .govt.nz) | static i18n |
| FAQ accordion | `faqs` scope=entry |

**Freshness:** Cron รายวันตรวจ `official_links` (status + hash ของหัวข้อหน้า) → เปลี่ยนหรือเสีย 2 วันติด ตั้ง `needs_review` ที่ `permission_types` / `entry_rules` ที่อ้างถึง และแจ้ง editor; แถวที่ `verified_at` เก่ากว่า 30 วัน helper จะไม่แสดงชื่อ permission แต่ให้ปุ่มไปเว็บทางการแทน

**API**

| Method + Path | Response | Cache |
| --- | --- | --- |
| `GET /api/v1/entry` | rules, permission types, links, documents, faqs, `last_verified_at` | ISR, tag `entry` |
| `POST /api/v1/feedback` | `{ entity, kind: outdated\|broken\|unclear, note }` | rate limit 5/ชม./IP |

**Tables:** `entry_rules`, `permission_types`, `official_links`, `link_checks`, `entry_documents`, `faqs`, `content_feedback`

**ข้อห้าม:** ไม่มีช่องเลขพาสปอร์ต / วันเกิด / การชำระเงิน, ไม่รับสมัครแทน, ไม่ลิงก์ไปเอเจนต์; ข้อความผลลัพธ์ต้องมี "Indicative, confirm on the official site" เสมอ

## 12. Prepare for Your Trip

Design เก็บ checklist "Saved on this device only" (localStorage) — ระบบรักษาพฤติกรรมนี้ไว้เป็นค่าเริ่มต้น และเพิ่ม sync เข้า trip เมื่อผู้ใช้ login เท่านั้น เนื้อหาที่เหลือเป็น editorial อ่านอย่างเดียว

| Component | ข้อมูล | เก็บสถานะที่ |
| --- | --- | --- |
| Progress "n of m ready" + Next up + % (sticky) | คำนวณจาก checklist | — |
| Personal checklist 4 ช่วง: 3 เดือนก่อน / 1 เดือนก่อน / 1 สัปดาห์ก่อน / วันเดินทาง (14 ข้อ) + Reset + Save as PDF | `checklist_templates` (`moment`, `sort`) | guest: `tanz:v1:prepare` · login: `trip_checklist_items` |
| Country tabs AU / NZ / Both | `checklist_templates.applies_to` | — |
| Best time to go: seasons กลับด้าน, 12 เดือน × region (comfort, crowds, recommended window) | `region_months` (`comfort`, `crowds`, `recommended`) | — |
| Packing guide ตาม season + "n/m packed" | `packing_items` (`season`, `group`) | เหมือน checklist |
| Know before you go: nine facts | `content_blocks` key `facts` | — |
| Connectivity table: option, setup, cost (Placeholder), best for, watch out | `connectivity_options` | — |
| Health & insurance | `content_blocks` key `health` | — |
| From the airport, without a car: airport code · city · options (time · fare) → Route details | `airport_transfers` → ลิงก์ไป Transport พร้อม from/to | — |
| Keep planning (Visa, Money, Dishes, My Trip) | static | — |

**API**

| Method + Path | Body / Query | Response |
| --- | --- | --- |
| `GET /api/v1/prepare` | `country`, `locale` | templates, months, packing, facts, connectivity, transfers (ISR) |
| `GET /api/v1/me/trips/:id/checklist` | — | items + done |
| `PATCH /api/v1/me/checklist-items/:id` | `{ done }` | item |
| `POST /api/v1/me/merge` | `{ prepare, packed, saved }` จาก localStorage | ผลรวมที่ merge แล้ว |
| `GET /api/v1/me/trips/:id/checklist.pdf` | — | PDF (render ฝั่ง server) |

**Tables:** `checklist_templates`, `trip_checklist_items`, `packing_items`, `trip_packing_items`, `region_months`, `connectivity_options`, `airport_transfers`, `content_blocks`

## 13. My Trip

Trip ใน Design เป็น itinerary รายวัน: แต่ละวันมี stops ตามเวลา และ **leg** ระหว่าง stop (train / bus / ferry / walk + ข้อความ เช่น "Circular Quay → St James, 4 min") พร้อมแผนที่ของวัน และกล่อง "Saved, not scheduled" ที่ลากเข้าวันได้ — legs คำนวณด้วย `routing` แล้วเก็บผลไว้ ไม่คำนวณใหม่ทุกครั้งที่เปิด

| Component | ข้อมูล |
| --- | --- |
| Header: วันที่ทริป, ชื่อ, Share, Export itinerary | `trips` |
| Day tabs: Day n · date · title | `trip_days` |
| Stop list: time, n, photo, kind, name, note, remove | `trip_stops` (→ `places`) |
| Leg ระหว่าง stop: mode + text | `trip_legs` (from\_stop, to\_stop, mode, duration, summary) |
| Summary "5 stops · 32 min in transit" | sum `trip_legs.duration_min` |
| Day map: เส้นทาง + หมุดเลข; วันที่อยู่นอกแผนที่เมือง (Blue Mountains) แสดงการ์ดสรุปแทน | `places.geom`; `trip_days.off_map` เมื่อ stop อยู่นอก bbox เมืองหลัก |
| Saved, not scheduled → "Add to Day n" | `saved_items` ที่ยังไม่มีใน `trip_stops` |

**Leg recompute:** เมื่อเพิ่ม / ลบ / ย้าย stop → mark leg รอบข้างเป็น `stale` → background call `routing.plan(prev, next, depart=prev.time+stay)` → เขียนผล (ใช้ mode ที่เร็วที่สุด, walk ถ้า ≤ 15 นาที) UI แสดง "calculating…" ระหว่างรอ

**API** (login; guest ใช้ local trip 1 อันแล้ว merge ทีหลัง)

| Method + Path | Body | Response |
| --- | --- | --- |
| `GET /api/v1/me/trips` · `POST` | `{ title, start_date, end_date, cities[] }` | trips / trip ใหม่ + days |
| `GET /api/v1/me/trips/:id` | — | days + stops + legs + saved-unscheduled |
| `POST /api/v1/me/trips/:id/days/:day/stops` | `{ place_id, time, note }` | stop + legs (stale) |
| `PATCH /api/v1/me/stops/:id` | `{ time, note, day_id, position }` | stop |
| `DELETE /api/v1/me/stops/:id` | — | 204, place กลับไปอยู่ saved |
| `GET/POST/DELETE /api/v1/me/saved` | `{ entity_type, entity_id }` | saved |
| `POST /api/v1/me/trips/:id/share` | — | `{ url }` token สุ่ม revoke ได้ |
| `GET /api/v1/me/trips/:id/export` | `format=pdf\|ics` | ไฟล์ itinerary / ปฏิทิน |
| `GET /api/v1/shared/:token` | — | trip read-only |

**Tables:** `trips`, `trip_days`, `trip_stops`, `trip_legs`, `saved_items`, `trip_shares`

## 14. Database schema (Supabase Postgres 16)

Schema ใหม่มี 59 ตารางใน 8 โดเมน ทุกตาราง content มี `status content_status`, `verified_at`, `updated_by`, `updated_at`; ทุกตาราง user data มี `user_id` + RLS แบบเจ้าของเท่านั้น

**14.1 Core & content**

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
create extension if not exists citext;

create type content_status as enum ('draft','published','archived');
create type country_code   as enum ('AU','NZ');
create type place_type     as enum ('attraction','restaurant','bar','cafe','station','village');
create type transit_mode   as enum ('train','metro','tram','bus','coach','ferry','walk');
create type season         as enum ('summer','autumn','winter','spring');
create type user_role      as enum ('user','editor','admin');
create type saved_entity   as enum ('place','dish','journey');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  locale text not null default 'th' check (locale in ('th','en')),
  home_currency char(3) not null default 'THB',
  theme text default 'system',
  role user_role not null default 'user',
  created_at timestamptz default now()
);

create table regions (
  id serial primary key,
  country country_code not null,
  slug text unique not null,
  name_i18n jsonb not null, state_i18n jsonb, lede_i18n jsonb,
  best_months int[],                        -- e.g. {9,10,11}
  cover_media_id uuid,
  featured_rank smallint,
  status content_status not null default 'draft'
);

create table cities (
  id serial primary key,
  region_id int not null references regions,
  slug text unique not null,
  name_i18n jsonb not null,
  timezone text not null,
  center geography(point,4326) not null,
  bbox geography(polygon,4326),
  status content_status not null default 'draft'
);

create table neighbourhoods (
  id serial primary key, city_id int references cities,
  name text not null, geom geography(polygon,4326)
);

create table tags (
  id serial primary key, slug text unique not null,
  kind text not null,                       -- interest | atmosphere | gallery_type | journey_mode
  name_i18n jsonb not null
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null, width int not null, height int not null,
  blurhash text, alt_i18n jsonb,
  credit text not null, license text not null,
  created_at timestamptz default now()
);

create table content_blocks (               -- tips, facts, timeline, health
  key text primary key,
  body_i18n jsonb not null,
  verified_at date, updated_at timestamptz default now()
);

create table faqs (
  id serial primary key, scope text not null,
  q_i18n jsonb not null, a_i18n jsonb not null, sort int default 0
);

create table hero_slides (
  id serial primary key, media_id uuid references media_assets,
  caption_i18n jsonb, place_id uuid, sort int default 0, active boolean default true
);

create table newsletter_subscribers (
  email citext primary key, locale text,
  confirmed_at timestamptz, token text unique, created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key, table_name text, row_id text, action text,
  diff jsonb, actor uuid references profiles, at timestamptz default now()
);
```

**14.2 Places, venues, gallery**

```sql
create table places (
  id uuid primary key default gen_random_uuid(),
  city_id int not null references cities,
  neighbourhood_id int references neighbourhoods,
  slug text unique not null,
  type place_type not null,
  category text,                            -- Beach, Mountain, Heritage... (gallery type)
  name_i18n jsonb not null, area_i18n jsonb, desc_i18n jsonb,
  best_time_i18n jsonb, access_i18n jsonb,  -- "how to get there" without a car
  geom geography(point,4326) not null,
  price_level smallint check (price_level between 0 and 4),
  price_note_i18n jsonb, hours_note_i18n jsonb,
  website text, is_closed boolean not null default false,
  status content_status not null default 'draft',
  verified_at date, updated_by uuid references profiles, updated_at timestamptz default now()
);
create index places_geom_gix on places using gist (geom);
create index places_city_type on places (city_id, type) where status = 'published';

create table place_hours (
  place_id uuid references places on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  open_time time not null, close_time time not null,   -- close < open = after midnight
  primary key (place_id, weekday, open_time)
);

create table place_tags (
  place_id uuid references places on delete cascade,
  tag_id int references tags on delete cascade,
  primary key (place_id, tag_id)
);

create table place_stop_links (             -- precomputed nearest stops
  place_id uuid references places on delete cascade,
  stop_id int references transit_stops on delete cascade,
  rank smallint not null,
  walk_min smallint not null, walk_geom geography(linestring,4326),
  primary key (place_id, stop_id)
);

create table place_nearby_venues (
  place_id uuid references places on delete cascade,
  venue_id uuid references places on delete cascade,
  sort smallint default 0,
  primary key (place_id, venue_id)
);

create table cuisines (id serial primary key, slug text unique, name_i18n jsonb);

create table venues (                       -- 1:1 with places of type restaurant/bar/cafe
  place_id uuid primary key references places on delete cascade,
  cuisine_id int references cuisines,
  dietary text[] default '{}',
  menu_highlights_i18n jsonb,
  drinks_i18n jsonb,
  booking text check (booking in ('required','recommended','walk_in'))
);

create table venue_drinks (
  place_id uuid references venues on delete cascade,
  drink text not null,                      -- wine | cocktails | beer | coffee | non_alc
  primary key (place_id, drink)
);

create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media_assets,
  place_id uuid not null references places,
  region_id int references regions,
  season season,
  title_i18n jsonb, sort int default 0,
  status content_status not null default 'draft'
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('venue','dish','place')),
  placement text,                           -- home_dining | dishes
  title_i18n jsonb not null, sub_i18n jsonb,
  status content_status not null default 'draft'
);

create table collection_items (
  collection_id uuid references collections on delete cascade,
  entity_id uuid not null, position int not null,
  primary key (collection_id, entity_id)
);
```

**14.3 Transit & routing**

```sql
create table transit_agencies (
  id serial primary key, country country_code not null,
  name text not null, gtfs_url text, website text, card_id int
);

create table transit_stops (
  id serial primary key, agency_id int references transit_agencies,
  gtfs_stop_id text, name text not null,
  geom geography(point,4326) not null, step_free boolean,
  unique (agency_id, gtfs_stop_id)
);
create index transit_stops_gix on transit_stops using gist (geom);

create table transit_lines (
  id serial primary key, agency_id int references transit_agencies,
  city_id int references cities,
  gtfs_route_id text, mode transit_mode not null,
  short_name text, long_name text,
  shape geography(multilinestring,4326),
  unique (agency_id, gtfs_route_id)
);

create table line_stops (
  line_id int references transit_lines on delete cascade,
  stop_id int references transit_stops on delete cascade,
  seq int not null, primary key (line_id, seq)
);

create table line_service_summary (         -- for the route explorer
  line_id int primary key references transit_lines on delete cascade,
  end_to_end_min int, headway_peak_min int, headway_offpeak_min int,
  fare_min numeric(6,2), fare_max numeric(6,2), computed_at timestamptz
);

create table transit_cards (
  id serial primary key, city_id int references cities,
  name text not null,                       -- Opal, myki, go card, AT HOP, Snapper
  contactless boolean, how_to_i18n jsonb, caps_i18n jsonb,
  official_url text, verified_at date
);

create table fare_rules (
  id serial primary key, agency_id int references transit_agencies,
  mode transit_mode, rule jsonb not null,   -- zones / distance bands / daily cap / off-peak %
  currency char(3) not null, verified_at date
);

create table scenic_routes (
  id serial primary key, country country_code, mode transit_mode,
  slug text unique, name_i18n jsonb, from_name text, to_name text,
  line_i18n jsonb, duration_text text, frequency_text text,
  fare_from numeric(8,2), currency char(3), cover_media_id uuid,
  status content_status not null default 'draft'
);

create table airport_transfers (
  id serial primary key, airport_code char(3), city_id int references cities,
  option_name text, mode transit_mode, duration_min int,
  fare_min numeric(6,2), fare_max numeric(6,2), currency char(3),
  verified_at date
);

create table journeys (                     -- curated itineraries + home route showcase
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null default 'itinerary' check (kind in ('itinerary','route_showcase')),
  country country_code, title_i18n jsonb, line_i18n jsonb,
  from_name text, to_name text, days smallint,
  price_from numeric(8,2), currency char(3),
  modes transit_mode[], cover_media_id uuid,
  status content_status not null default 'draft'
);

create table journey_legs (
  journey_id uuid references journeys on delete cascade,
  seq smallint, day smallint default 1,
  mode transit_mode not null, from_name text, to_name text,
  operator text, duration_min int, frequency_text text,
  primary key (journey_id, seq)
);
```

**14.4 Dishes**

```sql
create table dishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  country country_code not null, region_id int references regions,
  type text not null,                       -- savoury | sweet | drink | snack
  name_i18n jsonb not null, line_i18n jsonb,
  story_i18n jsonb, dispute_note_i18n jsonb,
  taste_i18n jsonb, served_i18n jsonb, allergy_i18n jsonb,
  dietary text[] default '{}',
  price_level smallint, price_text text,
  must_try_rank smallint, sort int default 0,
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft', verified_at date
);

create table dish_pairings (
  dish_id uuid references dishes on delete cascade,
  k_i18n jsonb, v_i18n jsonb, sort smallint,
  primary key (dish_id, sort)
);

create table dish_venues (
  dish_id uuid references dishes on delete cascade,
  place_id uuid references places on delete cascade,
  region_id int references regions,
  rank smallint not null, price_text text, note_i18n jsonb, verified_at date,
  primary key (dish_id, place_id)
);
```

**14.5 FX**

```sql
create table currencies (code char(3) primary key, name_i18n jsonb, symbol text, decimals smallint default 2);

create table fx_snapshots (
  fetched_at timestamptz primary key,
  base char(3) not null default 'AUD',
  rates jsonb not null,                     -- {"NZD":1.127,"THB":21.48,...}
  source text not null
);

create table fx_daily (
  day date, quote char(3), close numeric(18,8),
  primary key (day, quote)                  -- base AUD
);

create table cost_reference_items (
  id serial primary key, item_i18n jsonb not null, note_i18n jsonb,
  aud numeric(8,2), nzd numeric(8,2), verified_at date not null, sort int
);

create table budget_presets (
  country country_code, style text check (style in ('budget','comfortable','luxury')),
  per_day numeric(8,2) not null, note_i18n jsonb,
  primary key (country, style)
);
```

**14.6 Entry (Visa)**

```sql
create table permission_types (
  id serial primary key, country country_code not null, slug text unique,
  name_i18n jsonb, plain_i18n jsonb, who_i18n jsonb, how_i18n jsonb,
  processing_text text, fee_text text, validity_text text, good_i18n jsonb,
  official_link_id int, verified_at date, needs_review boolean default false
);

create table entry_rules (                  -- indicative mapping, editor-maintained
  nationality char(2) not null,             -- ISO 3166-1 alpha-2
  country country_code not null,
  purpose text not null check (purpose in ('tourism','work_study')),
  stay text not null check (stay in ('lt1','1to3','gt3')),
  permission_id int references permission_types,
  verified_at date, needs_review boolean default false,
  primary key (nationality, country, purpose, stay)
);

create table official_links (
  id serial primary key, country country_code, agency text,
  title_i18n jsonb, url text unique not null,
  health_status text default 'ok', content_hash text, last_checked_at timestamptz
);

create table link_checks (
  id bigserial primary key, link_id int references official_links on delete cascade,
  status_code int, final_url text, content_hash text, checked_at timestamptz default now()
);

create table entry_documents (
  id serial primary key, slug text unique, title_i18n jsonb, note_i18n jsonb,
  applies_to country_code[] default '{AU,NZ}', sort int
);

create table content_feedback (
  id bigserial primary key, entity text, kind text, note text,
  user_id uuid references profiles, created_at timestamptz default now(), resolved boolean default false
);
```

**14.7 Prepare**

```sql
create table checklist_templates (
  id serial primary key, slug text unique,
  moment text not null check (moment in ('3m','1m','1w','day0')),
  title_i18n jsonb, note_i18n jsonb,
  applies_to country_code[] default '{AU,NZ}', sort int
);

create table packing_items (
  id serial primary key, season season, grp text, title_i18n jsonb, sort int
);

create table region_months (
  region_id int references regions, month smallint check (month between 1 and 12),
  comfort smallint, crowds smallint, recommended boolean,
  primary key (region_id, month)
);

create table connectivity_options (
  id serial primary key, name_i18n jsonb, setup_i18n jsonb,
  cost_text text, best_i18n jsonb, watch_i18n jsonb, verified_at date
);
```

**14.8 Trip & user data**

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null, start_date date, end_date date,
  home_currency char(3) default 'THB',
  deleted_at timestamptz, created_at timestamptz default now(),
  check (end_date >= start_date)
);

create table trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  day_no smallint not null, date date, title text, off_map boolean default false,
  unique (trip_id, day_no)
);

create table trip_stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references trip_days on delete cascade,
  place_id uuid not null references places,
  position smallint not null, time time, note text
);

create table trip_legs (
  from_stop uuid references trip_stops on delete cascade,
  to_stop uuid references trip_stops on delete cascade,
  mode transit_mode, duration_min int, summary text,
  fare_min numeric(6,2), fare_max numeric(6,2),
  status text default 'stale' check (status in ('stale','ok','failed')),
  computed_at timestamptz,
  primary key (from_stop, to_stop)
);

create table saved_items (
  user_id uuid references profiles on delete cascade,
  entity_type saved_entity not null, entity_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, entity_type, entity_id)
);

create table trip_checklist_items (
  trip_id uuid references trips on delete cascade,
  template_id int references checklist_templates,
  done boolean default false, done_at timestamptz,
  primary key (trip_id, template_id)
);

create table trip_packing_items (
  trip_id uuid references trips on delete cascade,
  item_id int references packing_items,
  packed boolean default false,
  primary key (trip_id, item_id)
);

create table trip_shares (
  token text primary key default encode(gen_random_bytes(16),'hex'),
  trip_id uuid references trips on delete cascade,
  created_at timestamptz default now(), revoked_at timestamptz
);
```

**14.9 RLS**

```sql
-- content tables: public read of published rows, editors write
alter table places enable row level security;
create policy read_published on places for select using (status = 'published');
create policy editor_write on places for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('editor','admin')));
-- same pair on regions, cities, dishes, collections, gallery_photos, journeys,
-- scenic_routes, permission_types, entry_rules

-- user data: owner only
alter table trips enable row level security;
create policy own_trips on trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table trip_days enable row level security;
create policy own_days on trip_days for all using (
  exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));
-- trip_stops, trip_legs, trip_checklist_items, trip_packing_items, trip_shares
-- follow the same chain back to trips.user_id

alter table saved_items enable row level security;
create policy own_saved on saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- fx_snapshots, link_checks, audit_log, newsletter_subscribers: no client policy,
-- written by the service role in jobs and route handlers only
-- shared trips: RPC get_shared_trip(token) security definer, returns no user fields
```

## 15. Jobs, NFR, rollout

**Background jobs**

| Job | เวลา (UTC) | Runtime | ทำอะไร |
| --- | --- | --- | --- |
| `fx-ingest` | ทุกชั่วโมง | Vercel Cron | snapshot rates → `fx_snapshots` + Redis |
| `fx-daily` | 00:10 ทุกวัน | Vercel Cron | close รายวัน → `fx_daily`, ลบ snapshot > 30 วัน |
| `gtfs-sync` | อาทิตย์ 03:00 | GitHub Action | ดาวน์โหลด GTFS ทุก agency → upsert lines/stops/shapes → rebuild OTP graph → deploy |
| `line-summary` | หลัง `gtfs-sync` | SQL / Edge Function | คำนวณ `line_service_summary` (เวลา, headway, fare) |
| `stop-links` | หลัง `gtfs-sync` + เมื่อ place เปลี่ยน | Edge Function | nearest 3 stops + เวลาเดิน (OSRM foot) → `place_stop_links` |
| `leg-recompute` | queue (on demand) | Edge Function + `pgmq` | คำนวณ `trip_legs` ที่ `stale` ผ่าน OTP |
| `link-check` | 02:00 ทุกวัน | Edge Function | ตรวจ `official_links` → `needs_review` + แจ้ง editor |
| `content-stale` | จันทร์ 01:00 | `pg_cron` | แถวที่ `verified_at` > 6 เดือน (ราคา, ค่าโดยสาร, ชั่วโมงเปิด) → review queue |
| `newsletter-send` | วันที่ 1 ของเดือน | Resend / Postmark | ส่ง Dispatch ให้ subscriber ที่ confirm แล้ว |

**Infra ที่เพิ่มจากรอบก่อน:** OpenTripPlanner 2 บน VM 1 ตัว (4 vCPU / 16 GB, graph AU+NZ เมืองที่รองรับ) เปิดเฉพาะ private network ให้ Route Handler เรียก, OSRM foot profile (ใช้ตอน job เท่านั้น), queue `pgmq` ใน Postgres

**Migration order:** 14.1 → 14.3 (transit ก่อน เพราะ `place_stop_links` อ้าง `transit_stops`) → 14.2 → 14.4–14.8 → 14.9

**NFR**

| ด้าน | เป้า |
| --- | --- |
| Performance | LCP < 2.5 s มือถือ 4G · ISR TTFB < 200 ms · map API p95 < 300 ms · route plan p95 < 1.5 s (cache miss) |
| Resilience | FX ล้ม → snapshot เดิม + stale · OTP ล้ม → curated journey fallback · ทุกหน้าที่ Design มี error state ต้องมี API ที่คืน fallback |
| Privacy | Visa helper ไม่ส่งข้อมูลออก, checklist เก็บในเครื่องจน login, analytics ไม่มี PII |
| Accessibility | WCAG 2.2 AA, แผนที่มี list view, step-free filter ใน Transport |
| SEO | sitemap แยก destinations / venues / dishes / gallery, hreflang th/en, JSON-LD (TouristAttraction, Restaurant, BarOrPub) |

**Rollout**

1. **Phase 1 (สัปดาห์ 1–6):** core, Destinations, Map (Sydney + Melbourne + Auckland), Eat & Drink, Gallery, Money, Visa, admin CRUD
2. **Phase 2 (สัปดาห์ 7–11):** Transport + OTP + `fare_rules`, Signature Dishes, Prepare (local + sync), newsletter
3. **Phase 3 (สัปดาห์ 12+):** My Trip เต็ม (legs, share, PDF/ICS), เมืองเพิ่ม (Brisbane, Hobart, Queenstown, Wellington, Rotorua), PWA offline สำหรับ trip และ checklist

**Open questions**

- [ ] Host OTP เองตั้งแต่ Phase 2 หรือใช้ Google Routes API ชั่วคราวก่อน
- [ ] ใครดูแลและยืนยัน `entry_rules` (mapping สัญชาติ → permission) ก่อน launch
- [ ] FX provider ตัวไหน และ license อนุญาตแสดงสาธารณะไหม
- [ ] ข้อมูลร้าน/ราคา ใครเป็น editor และรอบตรวจซ้ำกี่เดือน

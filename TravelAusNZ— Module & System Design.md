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

**Module map**

| Module | ใช้ในหน้า | หน้าที่หลัก |
| --- | --- | --- |
| `core-auth` | ทุกหน้า | login, profile, preferences (ภาษา, สกุลเงินบ้าน) |
| `core-content` | ทุกหน้า | regions, cities, media, tags, i18n text |
| `core-search` | Home, Map, Dishes | ค้นหารวม (place / dish / city) |
| `places` | Home, Map, Dishes | attractions, restaurants, bars, opening hours |
| `transit` | Map, Prepare | routes, stops, GTFS feeds, ตั๋ว/บัตรโดยสาร |
| `fx` | Currency, Prepare | rate ingestion, convert, history, cost reference |
| `dishes` | Dishes | dish catalog, collections, where-to-try |
| `visa` | Visa & Entry | helper wizard, official links, freshness check |
| `trip` | Prepare + ทุกหน้า (save) | saved items, checklist, trip plan, budget |
| `admin` | `/admin` | CRUD content, review queue, audit log |

สถาปัตยกรรมรวม: browser → Vercel Edge (ISR pages + Route Handlers `/api/v1/*`) → Supabase (Postgres/Auth/Storage) โดยมี Cron jobs ดึงข้อมูลภายนอก (FX, GTFS, link check) เข้า DB ล่วงหน้า หน้าเว็บจึง**ไม่เรียก API ภายนอกตอน request เลย** (ดูแผนภาพด้านล่าง)

&#91;embedded content: System architecture · 3 layers + external sources\]

เส้นทางเดียวที่แตะโลกภายนอกคือ Cron (ดึงเข้า) กับ map tiles (browser โหลดตรง) ส่วน request ของผู้ใช้ทุกตัวจบใน Vercel + Data layer

## 2. Shared platform modules

ทุกหน้าใช้ชุด module กลางเดียวกัน หน้าใหม่จึงประกอบจาก module เดิมได้โดยไม่ต้องเขียน infra ซ้ำ

**2.1 `core-auth`** — Supabase Auth; trigger `on auth.users insert` สร้างแถวใน `profiles` อัตโนมัติ เก็บ `locale` (th/en), `home_currency` (default THB), `units`. Guest ใช้งานได้ทุกหน้า แต่การ save ต้อง login (เก็บ save ชั่วคราวใน localStorage แล้ว merge เข้า DB หลัง login)

**2.2 `core-content` + i18n** — ข้อความที่แปลได้เก็บเป็นคอลัมน์ `jsonb` รูป `{"th": "...", "en": "..."}` (เช่น `name_i18n`, `summary_i18n`) อ่านด้วย helper `t(row.name_i18n, locale)` fallback เป็น en. UI string แยกไฟล์ `messages/th.json`, `messages/en.json` (next-intl). URL: `/th/...`, `/en/...`

**2.3 `core-search`** — Postgres full-text + `pg_trgm` บน materialized view `search_index` (รวม places, dishes, cities) refresh ทุก 15 นาที. Endpoint เดียว `GET /api/v1/search?q=&type=&region=` ตอบ ≤ 20 รายการ

**2.4 Media** — bucket `media` (public read), path `/{entity}/{id}/{hash}.webp`; ตาราง `media_assets` เก็บ alt text i18n, credit, license (สำคัญเพราะรูปสถานที่มักมีลิขสิทธิ์)

**2.5 Caching strategy**

| ข้อมูล | Render | Revalidate |
| --- | --- | --- |
| หน้า content (place, dish, visa) | SSG + ISR | on-demand เมื่อ admin publish (`revalidateTag`) |
| FX rates | Edge cache + Redis | 1 ชม. |
| Map tiles / GeoJSON | CDN | 24 ชม. |
| User data (saved, checklist) | dynamic, no-store | — |

**2.6 API conventions** — REST ใต้ `/api/v1`, JSON, cursor pagination (`?cursor=&limit=`), error รูป `{ error: { code, message } }`, validate ด้วย Zod, rate limit 60 req/min/IP (Upstash) เฉพาะ endpoint เขียน + search

**2.7 Admin & audit** — role ใน `profiles.role` (`user` | `editor` | `admin`). ทุกตาราง content มี `status` (`draft` | `published` | `archived`), `updated_by`, `updated_at`; trigger เขียน `audit_log` ทุกครั้งที่แก้

**2.8 Analytics** — event หลัก: `search`, `place_view`, `save_item`, `fx_convert`, `visa_official_click`, `checklist_complete` (PostHog) ไม่ส่ง PII

## 3. Page 1 — Home + Interactive Map

หน้า Home เป็น SSG ที่ดึง featured content จาก DB ตอน build ส่วน Map เป็น client component ที่โหลดจุดตาม viewport (bbox) จาก API ที่ cache ได้ — ไม่โหลดทุกจุดทีเดียว

**Frontend modules**

| Component | ข้อมูลจาก | Render |
| --- | --- | --- |
| `HeroSearch` | `/api/v1/search` | client (debounce 250 ms) |
| `RegionPicker` (AU / NZ / เมือง) | `regions`, `cities` | SSG |
| `FeaturedCollections` | `collections` where `placement='home'` | SSG + ISR |
| `MapCanvas` (MapLibre) | `/api/v1/map/places`, `/api/v1/map/transit` | client, lazy-load |
| `LayerToggle` (Attractions / Food / Bars / Transit) | URL query `?layers=` | client |
| `PlaceDrawer` (คลิกจุดแล้วเปิด) | `/api/v1/places/:slug` | client, prefetch on hover |
| `SaveButton` | `/api/v1/me/saved` | client, optimistic |

แยกประเภทจุดด้วย **icon shape + line style** ไม่ใช้สี (ตาม design system 3 สี): attraction = วงกลม, restaurant = สี่เหลี่ยม, bar = สามเหลี่ยม, train = เส้นทึบ, bus = เส้นประ, ferry = เส้นจุด

**API**

| Method + Path | Query / Body | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/home` | `locale` | regions, featured collections, top places | ISR, tag `home` |
| `GET /api/v1/map/places` | `bbox`, `types[]`, `tags[]`, `open_now` | GeoJSON FeatureCollection (≤ 500 จุด, cluster ฝั่ง client) | 10 นาที, key = bbox ปัด 2 ตำแหน่ง |
| `GET /api/v1/map/transit` | `city_id`, `modes[]` | GeoJSON routes + stops | 24 ชม. |
| `GET /api/v1/places/:slug` | `locale` | place detail, hours, nearby stops (≤ 500 m), media | ISR |
| `GET /api/v1/places/:slug/nearby` | `radius`, `types[]` | places ใกล้เคียงเรียงตามระยะ | 1 ชม. |

**Key query** (PostGIS — bbox + open-now):

```sql
select id, slug, type, name_i18n, st_asgeojson(geom)::json as geometry
from places
where status = 'published'
  and geom && st_makeenvelope($1,$2,$3,$4,4326)
  and type = any($5)
  and ($6 = false or is_open_now(id, now()))
limit 500;
```

**DB tables ที่ใช้:** `regions`, `cities`, `places`, `place_hours`, `place_tags`, `tags`, `transit_agencies`, `transit_routes`, `transit_stops`, `route_stops`, `collections`, `collection_items`, `media_assets`, `saved_items` (DDL เต็มที่ข้อ 8)

**Edge cases:** เวลาเปิดข้ามเที่ยงคืน (bar ปิดตี 2) → `place_hours` เก็บ `close_time` < `open_time` แล้วฟังก์ชัน `is_open_now` จัดการ; timezone ต่างเมือง (Perth UTC+8, Auckland UTC+12/13) → ใช้ `cities.timezone`; daylight saving AU/NZ ไม่ตรงกัน → คำนวณด้วย `at time zone` เสมอ ห้าม hardcode offset

## 4. Page 2 — Currency Converter

อัตราแลกเปลี่ยนถูกดึงเข้า DB ทุกชั่วโมงโดย Cron แล้วหน้าเว็บอ่านจาก DB/Redis เท่านั้น การแปลงเงินคำนวณฝั่ง client จาก rate ชุดเดียว — ไม่มี API call ต่อการพิมพ์ตัวเลข

**Frontend modules**

| Component | หน้าที่ |
| --- | --- |
| `ConverterCard` | THB ⇄ AUD / NZD (default from = `profiles.home_currency`), คำนวณใน browser |
| `RateBadge` | แสดง rate + เวลาอัปเดต + แหล่งข้อมูล; เตือนถ้า rate เก่ากว่า 6 ชม. |
| `RateTrendChart` | กราฟ 7 / 30 / 90 / 365 วัน (daily close) |
| `CostReference` | ราคาอ้างอิง (กาแฟ, Opal/Myki ต่อเที่ยว, มื้อกลางวัน) แปลงเป็นเงินบ้านอัตโนมัติ |
| `RateAlert` (phase 2) | แจ้งเตือนเมื่อ AUD/THB ต่ำกว่าเป้า |

**Rate ingestion**

1. Vercel Cron `0 * * * *` เรียก `POST /api/internal/fx/ingest` (ตรวจ header `CRON_SECRET`)
2. ดึงจาก provider หลัก (เช่น exchangerate.host หรือ Open Exchange Rates) base = USD — ถ้า fail ใช้ provider สำรอง
3. คำนวณ cross rate THB/AUD, THB/NZD, AUD/NZD แล้ว insert ลง `fx_rates` (1 แถว/คู่/ชั่วโมง)
4. เขียน snapshot ล่าสุดลง Redis key `fx:latest` (TTL 2 ชม.)
5. Cron รายวัน 00:10 UTC รวมเป็น `fx_rates_daily` (open/high/low/close) สำหรับกราฟ และลบรายชั่วโมงที่เก่ากว่า 30 วัน

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/fx/latest` | `base`, `symbols[]` | `{ base, rates, fetched_at, source }` | Edge 1 ชม. |
| `GET /api/v1/fx/history` | `pair`, `range=7d\|30d\|90d\|1y` | daily OHLC array | 6 ชม. |
| `GET /api/v1/fx/cost-reference` | `country`, `locale` | รายการราคาอ้างอิง (สกุลท้องถิ่น) | ISR |
| `POST /api/v1/me/fx-alerts` (P2) | `{ pair, threshold, direction }` | alert | no-store |

**DB tables:** `currencies`, `fx_rates`, `fx_rates_daily`, `cost_reference_items`, `fx_alerts` (P2)

**หมายเหตุ:** rate ที่แสดงเป็น mid-market — ใส่ข้อความใต้ converter ว่าเรทจริงจากธนาคาร/บัตรจะต่างไป 1–3%; ราคาใน `cost_reference_items` มี `verified_at` และให้ editor ทบทวนทุก 6 เดือน

## 5. Page 3 — Signature Dishes

หน้านี้เป็น dish-first catalog: `dishes` เป็นศูนย์กลาง แล้วผูกกับร้านใน `places` ผ่าน `dish_venues` จึงใช้ข้อมูลร้านชุดเดียวกับแผนที่ ไม่ต้องดูแลซ้ำสองที่

**Frontend modules**

| Component | ข้อมูลจาก | Render |
| --- | --- | --- |
| `DishGrid` + filter (ประเทศ, ภูมิภาค, ประเภท: savory/sweet/drink, dietary) | `/api/v1/dishes` | SSG หน้าแรก + client filter |
| `CuratedCollections` (เช่น “Melbourne coffee culture”, “Kiwi bakery classics”) | `collections` where `kind='dish'` | SSG |
| `DishDetail` (`/dishes/[slug]`) — origin story, คำอธิบายรสชาติ, dietary flags, ราคาโดยประมาณ | `dishes` | SSG + ISR |
| `WhereToTry` — รายการร้าน + mini map | `/api/v1/dishes/:slug/venues` | ISR |
| `SaveButton` | `saved_items` | client |

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/dishes` | `country`, `region_id`, `category`, `diet[]`, `cursor` | list (card fields) | ISR, tag `dishes` |
| `GET /api/v1/dishes/:slug` | `locale` | detail + media + related dishes | ISR |
| `GET /api/v1/dishes/:slug/venues` | `city_id`, `near=lat,lng` | venues เรียงตาม `rank` หรือระยะทาง | 1 ชม. |
| `GET /api/v1/collections/:slug` | `locale` | collection + items (dish หรือ place) | ISR |

**DB tables:** `dishes`, `dish_categories`, `dietary flags` (enum array ใน `dishes.dietary`), `dish_venues`, `collections`, `collection_items`, `places`, `media_assets`

**กติกาเนื้อหา:** `dish_venues` มี `editor_note_i18n` (ทำไมแนะนำร้านนี้), `price_local` + `verified_at`; ร้านที่ `places.is_closed = true` จะถูกซ่อนจาก WhereToTry อัตโนมัติ และขึ้นใน review queue ของ admin ให้หาร้านทดแทน

## 6. Page 4 — Visa & Entry

หน้านี้เป็น **helper ที่พาไปเว็บทางการ** ไม่ใช่ตัวตัดสินสิทธิ์วีซ่า ระบบจึงไม่เก็บ rule ตามสัญชาติและไม่เก็บข้อมูลพาสปอร์ตใด ๆ — เก็บแค่ “เนื้อหาแนะนำทั่วไป + ลิงก์ทางการ” และมี job ตรวจลิงก์/ความสดของเนื้อหาสม่ำเสมอ

**Frontend modules**

| Component | หน้าที่ |
| --- | --- |
| `DestinationTabs` | Australia / New Zealand / ทั้งสองประเทศ |
| `EntryHelperWizard` | 3 คำถามแบบไม่ระบุตัวตน: ไปประเทศไหน, จุดประสงค์ (เที่ยว / transit / ทำงาน-เรียน), ผ่านอีกประเทศไหม → แสดง “หัวข้อที่ควรเช็ก” + ปุ่มไปเว็บทางการ. คำตอบเก็บแค่ใน URL state ไม่ส่งเข้า DB |
| `OfficialLinksPanel` | ลิงก์ Department of Home Affairs (AU), Immigration New Zealand, NZeTA, ABF / MPI biosecurity |
| `ArrivalChecklist` | สิ่งที่ต้องเตรียมตอนถึง (ประกาศสิ่งของ, biosecurity) เพิ่มเข้า trip checklist ได้ |
| `FreshnessBanner` | “ตรวจสอบล่าสุด {date}” ทุก section; ถ้าเกิน 30 วันหรือมีลิงก์เสีย ซ่อน section นั้นและขึ้นข้อความให้ไปเว็บทางการ |
| `Disclaimer` | ข้อความคงที่: ข้อมูลอาจเปลี่ยน ตรวจสอบจากเว็บทางการก่อนเดินทาง |

**API**

| Method + Path | Query | Response | Cache |
| --- | --- | --- | --- |
| `GET /api/v1/visa/guides` | `country`, `purpose`, `locale` | guide sections + official links + `last_verified_at` | ISR, tag `visa` |
| `GET /api/v1/visa/links` | `country` | official links + `health_status` | 6 ชม. |
| `POST /api/v1/visa/feedback` | `{ section_id, kind: outdated\|broken\|unclear, note }` | 201 | rate limit 5/ชม./IP |

**Freshness job** (Cron รายวัน 02:00 UTC)

1. วนทุกแถวใน `official_links` → HTTP HEAD/GET (timeout 10 วิ, follow redirect ≤ 3)
2. บันทึกผลลง `link_checks` (status code, final URL, content hash ของ `<title>` + หัวข้อหลัก)
3. ถ้า status ≠ 2xx 2 วันติด หรือ content hash เปลี่ยน → set `needs_review = true` ใน `visa_guide_sections` ที่อ้างลิงก์นั้น และแจ้ง editor (email/LINE)
4. Section ที่ `last_verified_at` เกิน 30 วันจะไม่แสดงเนื้อหา แสดงแค่ลิงก์ทางการ

**DB tables:** `visa_guide_sections`, `official_links`, `section_links`, `link_checks`, `content_feedback`

**ข้อห้ามของระบบ:** ไม่มีช่องกรอกเลขพาสปอร์ต/สัญชาติ/วันเกิด, ไม่มีการทำนายผลวีซ่า, ไม่มีลิงก์ไป agent ที่เก็บค่าบริการ

## 7. Page 5 — Prepare for Your Trip

หน้านี้เป็นจุดรวม user data ของทั้งเว็บ: trip ที่สร้าง, checklist จาก template, ของที่ save ไว้จากทุกหน้า และงบประมาณที่แปลงสกุลเงินด้วย `fx` module — เป็นหน้าเดียวที่ dynamic เต็มรูปแบบ

**Frontend modules**

| Component | ข้อมูลจาก | หมายเหตุ |
| --- | --- | --- |
| `TripHeader` — ชื่อทริป, วันที่, เมืองที่จะไป | `trips`, `trip_cities` | สร้างได้หลายทริป |
| `PrepChecklist` — หมวด: เอกสาร, เงิน, SIM/eSIM, การเดินทาง, ฤดูกาล/เสื้อผ้า, biosecurity | `checklist_templates` → copy เป็น `trip_checklist_items` | tick ได้, เพิ่มข้อเองได้, แสดง % เสร็จ |
| `TimelineByDate` — “ก่อนเดินทาง 60 / 30 / 7 / 1 วัน” | `checklist_templates.due_offset_days` + `trips.start_date` | คำนวณ due date ให้อัตโนมัติ |
| `TransportCardGuide` — Opal (Sydney), Myki (Melbourne), go card (Brisbane), Snapper/Bee Card (NZ) | `transit_cards` | ผูกกับเมืองในทริป |
| `SeasonWeather` — อากาศเฉลี่ยรายเดือน | `city_climate` (ข้อมูลคงที่) | ไม่เรียก weather API |
| `BudgetPlanner` — งบต่อวัน × จำนวนวัน, แปลงเป็นเงินบ้าน | `trip_budget_items` + `fx/latest` | ใช้ cost reference เป็นค่าเริ่มต้น |
| `SavedBoard` — places/dishes ที่ save ไว้ จัดกลุ่มตามเมือง | `saved_items` | ลากเข้า trip ได้ |
| `ExportShare` — PDF / ลิงก์แชร์แบบ read-only | `trips.share_token` | token สุ่ม revoke ได้ |

**API** (ทั้งหมดต้อง login ยกเว้น shared view; `no-store`)

| Method + Path | Body / Query | Response |
| --- | --- | --- |
| `GET /api/v1/me/trips` | — | trips ของ user |
| `POST /api/v1/me/trips` | `{ title, start_date, end_date, city_ids[], home_currency }` | trip + checklist ที่ seed จาก template |
| `PATCH /api/v1/me/trips/:id` | partial | trip |
| `DELETE /api/v1/me/trips/:id` | — | 204 (soft delete) |
| `GET /api/v1/me/trips/:id/checklist` | — | items จัดกลุ่มตาม category |
| `PATCH /api/v1/me/checklist-items/:id` | `{ done, note, due_date }` | item |
| `POST /api/v1/me/trips/:id/checklist-items` | `{ category, title }` | item (custom) |
| `GET/POST/DELETE /api/v1/me/saved` | `{ entity_type, entity_id, trip_id? }` | saved item |
| `PUT /api/v1/me/trips/:id/budget` | `[{ category, amount, currency }]` | budget + total ในเงินบ้าน |
| `POST /api/v1/me/trips/:id/share` | — | `{ share_url }` |
| `GET /api/v1/shared/:token` | — | trip read-only (ไม่มีข้อมูลส่วนตัว) |

**DB tables:** `trips`, `trip_cities`, `checklist_templates`, `trip_checklist_items`, `trip_budget_items`, `saved_items`, `transit_cards`, `city_climate`

**Seeding logic:** ตอนสร้าง trip ฟังก์ชัน `create_trip()` (SQL, `security definer`) จะ insert trip + copy template ที่ `applies_to` ตรงกับประเทศของเมืองที่เลือก แล้วคำนวณ `due_date = start_date - due_offset_days` ใน transaction เดียว

## 8. Database schema (Supabase Postgres)

Schema มี 36 ตารางแบ่ง 7 กลุ่ม: core, places, transit, fx, dishes, visa, trip ทุกตาราง content ใช้ `content_status` + `updated_at`/`updated_by`; ตาราง user data ผูก `user_id` และเปิด RLS

**8.1 Extensions, enums, core**

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

create type content_status as enum ('draft','published','archived');
create type country_code   as enum ('AU','NZ');
create type place_type     as enum ('attraction','restaurant','bar','cafe','market','viewpoint');
create type transit_mode   as enum ('train','metro','tram','bus','ferry','coach');
create type user_role      as enum ('user','editor','admin');
create type saved_entity   as enum ('place','dish','collection');

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  locale        text not null default 'th' check (locale in ('th','en')),
  home_currency char(3) not null default 'THB',
  role          user_role not null default 'user',
  created_at    timestamptz not null default now()
);

create table regions (
  id serial primary key,
  country country_code not null,
  slug text unique not null,
  name_i18n jsonb not null,
  sort int default 0
);

create table cities (
  id serial primary key,
  region_id int not null references regions,
  slug text unique not null,
  name_i18n jsonb not null,
  timezone text not null,            -- e.g. 'Australia/Sydney'
  center geography(point,4326) not null,
  status content_status not null default 'draft'
);

create table tags (
  id serial primary key,
  slug text unique not null,
  name_i18n jsonb not null,
  kind text not null                -- 'vibe' | 'diet' | 'access' ...
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  width int, height int,
  alt_i18n jsonb,
  credit text, license text not null,
  created_at timestamptz default now()
);

create table audit_log (
  id bigserial primary key,
  table_name text not null, row_id text not null,
  action text not null, diff jsonb,
  actor uuid references profiles, at timestamptz default now()
);
```

**8.2 Places & collections**

```sql
create table places (
  id uuid primary key default gen_random_uuid(),
  city_id int not null references cities,
  slug text unique not null,
  type place_type not null,
  name_i18n jsonb not null,
  summary_i18n jsonb,
  body_i18n jsonb,
  address text,
  geom geography(point,4326) not null,
  price_level smallint check (price_level between 1 and 4),
  website text, phone text,
  cover_media_id uuid references media_assets,
  is_closed boolean not null default false,
  status content_status not null default 'draft',
  updated_by uuid references profiles,
  updated_at timestamptz not null default now()
);
create index places_geom_gix on places using gist (geom);
create index places_city_type_idx on places (city_id, type) where status = 'published';

create table place_hours (
  place_id uuid references places on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  open_time time not null,
  close_time time not null,          -- < open_time = closes after midnight
  primary key (place_id, weekday, open_time)
);

create table place_tags (
  place_id uuid references places on delete cascade,
  tag_id int references tags on delete cascade,
  primary key (place_id, tag_id)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('place','dish','mixed')),
  placement text,                    -- 'home' | null
  title_i18n jsonb not null, intro_i18n jsonb,
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft',
  updated_at timestamptz default now()
);

create table collection_items (
  collection_id uuid references collections on delete cascade,
  entity_type saved_entity not null,
  entity_id uuid not null,
  position int not null,
  note_i18n jsonb,
  primary key (collection_id, entity_type, entity_id)
);

create or replace function is_open_now(p_place uuid, p_at timestamptz)
returns boolean language sql stable as $$
  with t as (
    select (p_at at time zone c.timezone) as local
    from places p join cities c on c.id = p.city_id where p.id = p_place
  )
  select exists (
    select 1 from place_hours h, t
    where h.place_id = p_place and (
      (h.close_time > h.open_time and h.weekday = extract(dow from t.local)
        and t.local::time between h.open_time and h.close_time)
      or (h.close_time < h.open_time and (
        (h.weekday = extract(dow from t.local) and t.local::time >= h.open_time)
        or (h.weekday = (extract(dow from t.local)::int + 6) % 7 and t.local::time < h.close_time)))
    ));
$$;
```

**8.3 Transit**

```sql
create table transit_agencies (
  id serial primary key, city_id int references cities,
  name text not null, gtfs_url text, website text
);

create table transit_routes (
  id serial primary key,
  agency_id int not null references transit_agencies,
  gtfs_route_id text, mode transit_mode not null,
  short_name text, long_name_i18n jsonb,
  shape geography(multilinestring,4326),
  unique (agency_id, gtfs_route_id)
);
create index transit_routes_shape_gix on transit_routes using gist (shape);

create table transit_stops (
  id serial primary key,
  agency_id int not null references transit_agencies,
  gtfs_stop_id text, name text not null,
  geom geography(point,4326) not null,
  unique (agency_id, gtfs_stop_id)
);
create index transit_stops_geom_gix on transit_stops using gist (geom);

create table route_stops (
  route_id int references transit_routes on delete cascade,
  stop_id int references transit_stops on delete cascade,
  seq int not null,
  primary key (route_id, stop_id)
);

create table transit_cards (
  id serial primary key,
  city_id int references cities,
  name text not null,                -- Opal, Myki, go card, Snapper, Bee Card
  how_to_i18n jsonb, official_url text,
  verified_at date
);

create table city_climate (
  city_id int references cities,
  month smallint check (month between 1 and 12),
  avg_high_c numeric(4,1), avg_low_c numeric(4,1), rain_days smallint,
  primary key (city_id, month)
);
```

**8.4 FX**

```sql
create table currencies (
  code char(3) primary key, name_i18n jsonb, symbol text, decimals smallint default 2
);

create table fx_rates (
  base char(3) references currencies,
  quote char(3) references currencies,
  rate numeric(18,8) not null,
  source text not null,
  fetched_at timestamptz not null,
  primary key (base, quote, fetched_at)
);

create table fx_rates_daily (
  base char(3), quote char(3), day date,
  open numeric(18,8), high numeric(18,8), low numeric(18,8), close numeric(18,8),
  primary key (base, quote, day)
);

create table cost_reference_items (
  id serial primary key,
  country country_code not null, city_id int references cities,
  label_i18n jsonb not null,
  price_local numeric(10,2) not null, currency char(3) not null,
  verified_at date not null, sort int default 0
);

create table fx_alerts (                 -- phase 2
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  base char(3), quote char(3), threshold numeric(18,8),
  direction text check (direction in ('above','below')),
  last_fired_at timestamptz, active boolean default true
);
```

**8.5 Dishes**

```sql
create table dish_categories (
  id serial primary key, slug text unique, name_i18n jsonb   -- savory, sweet, drink
);

create table dishes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  country country_code not null,
  region_id int references regions,
  category_id int references dish_categories,
  name_i18n jsonb not null,
  story_i18n jsonb, taste_i18n jsonb,
  dietary text[] default '{}',       -- 'vegetarian','vegan','gluten_free','contains_nuts'
  typical_price_local numeric(8,2),
  cover_media_id uuid references media_assets,
  status content_status not null default 'draft',
  updated_by uuid references profiles,
  updated_at timestamptz default now()
);

create table dish_venues (
  dish_id uuid references dishes on delete cascade,
  place_id uuid references places on delete cascade,
  rank smallint not null default 1,
  editor_note_i18n jsonb,
  price_local numeric(8,2),
  verified_at date,
  primary key (dish_id, place_id)
);
```

**8.6 Visa & Entry**

```sql
create table official_links (
  id serial primary key,
  country country_code not null,
  agency text not null,              -- Home Affairs, Immigration NZ, ABF, MPI
  title_i18n jsonb not null, url text not null unique,
  health_status text default 'ok',   -- ok | redirected | broken
  last_checked_at timestamptz, content_hash text
);

create table visa_guide_sections (
  id serial primary key,
  country country_code not null,
  purpose text not null check (purpose in ('tourism','transit','work_study','arrival')),
  title_i18n jsonb not null, body_i18n jsonb not null,
  sort int default 0,
  last_verified_at date not null,
  needs_review boolean not null default false,
  status content_status not null default 'draft'
);

create table section_links (
  section_id int references visa_guide_sections on delete cascade,
  link_id int references official_links on delete cascade,
  primary key (section_id, link_id)
);

create table link_checks (
  id bigserial primary key,
  link_id int references official_links on delete cascade,
  status_code int, final_url text, content_hash text,
  checked_at timestamptz default now()
);

create table content_feedback (
  id bigserial primary key,
  entity_type text not null, entity_id text not null,
  kind text check (kind in ('outdated','broken','unclear')),
  note text, user_id uuid references profiles,
  created_at timestamptz default now(), resolved boolean default false
);
```

**8.7 Trip & user data**

```sql
create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null,
  start_date date, end_date date,
  home_currency char(3) not null default 'THB',
  share_token text unique,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

create table trip_cities (
  trip_id uuid references trips on delete cascade,
  city_id int references cities,
  arrive date, depart date,
  primary key (trip_id, city_id)
);

create table checklist_templates (
  id serial primary key,
  category text not null,            -- documents, money, sim, transport, packing, biosecurity
  title_i18n jsonb not null, detail_i18n jsonb,
  applies_to country_code[] not null default '{AU,NZ}',
  due_offset_days int,               -- days before start_date
  sort int default 0
);

create table trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  template_id int references checklist_templates,
  category text not null, title text not null,
  due_date date, done boolean not null default false,
  note text, sort int default 0
);

create table trip_budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  category text not null,            -- stay, food, transport, activities, other
  amount numeric(12,2) not null, currency char(3) not null,
  per_day boolean default false
);

create table saved_items (
  user_id uuid references profiles on delete cascade,
  entity_type saved_entity not null,
  entity_id uuid not null,
  trip_id uuid references trips on delete set null,
  created_at timestamptz default now(),
  primary key (user_id, entity_type, entity_id)
);
```

**8.8 Search index**

```sql
create materialized view search_index as
  select 'place' as kind, p.id, p.slug, c.slug as city, p.name_i18n,
         to_tsvector('simple', coalesce(p.name_i18n->>'en','') || ' ' || coalesce(p.name_i18n->>'th','')) as tsv
  from places p join cities c on c.id = p.city_id where p.status = 'published'
  union all
  select 'dish', d.id, d.slug, null, d.name_i18n,
         to_tsvector('simple', coalesce(d.name_i18n->>'en','') || ' ' || coalesce(d.name_i18n->>'th',''))
  from dishes d where d.status = 'published';
create unique index on search_index (kind, id);
create index search_tsv_idx on search_index using gin (tsv);
create index search_trgm_idx on search_index using gin ((name_i18n->>'en') gin_trgm_ops);
```

ใช้ `'simple'` config เพราะ Postgres ไม่มี Thai stemmer ส่วนคำไทยที่ไม่มีเว้นวรรคให้ fallback ด้วย trigram (`ilike` + `similarity`)

**8.9 Row Level Security**

```sql
-- content: ทุกคนอ่านได้เฉพาะ published, editor/admin เขียนได้
alter table places enable row level security;
create policy places_read on places for select using (status = 'published');
create policy places_edit on places for all
  using (exists (select 1 from profiles where id = auth.uid() and role in ('editor','admin')));
-- ทำแบบเดียวกันกับ dishes, collections, visa_guide_sections, cities

-- user data: เจ้าของเท่านั้น
alter table trips enable row level security;
create policy trips_owner on trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table trip_checklist_items enable row level security;
create policy items_owner on trip_checklist_items for all
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));
-- เหมือนกันกับ trip_cities, trip_budget_items

alter table saved_items enable row level security;
create policy saved_owner on saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table profiles enable row level security;
create policy profile_self on profiles for all using (id = auth.uid());

-- fx_rates, link_checks, audit_log: ไม่มี policy สำหรับ anon/authenticated → เขียนผ่าน service role ใน Cron เท่านั้น
-- shared trip: อ่านผ่าน RPC get_shared_trip(token) แบบ security definer ที่คืนเฉพาะ field ปลอดภัย
```

## 9. Background jobs, NFR, rollout

**Background jobs**

| Job | ตารางเวลา (UTC) | Runtime | ทำอะไร |
| --- | --- | --- | --- |
| `fx-ingest` | ทุกชั่วโมง `:00` | Vercel Cron → Route Handler | ดึง rate → `fx_rates` + Redis `fx:latest` |
| `fx-rollup` | 00:10 ทุกวัน | Vercel Cron | สร้าง `fx_rates_daily`, ลบรายชั่วโมง > 30 วัน |
| `link-check` | 02:00 ทุกวัน | Supabase Edge Function | ตรวจ `official_links` → `link_checks`, ตั้ง `needs_review` |
| `gtfs-sync` | อาทิตย์ 03:00 | Edge Function (หรือ GitHub Action ถ้าไฟล์ใหญ่) | import routes/stops/shapes ของแต่ละ agency |
| `search-refresh` | ทุก 15 นาที | `pg_cron` | `refresh materialized view concurrently search_index` |
| `content-stale` | จันทร์ 01:00 | `pg_cron` | หา `verified_at` เก่ากว่า 6 เดือน → review queue ของ admin |
| `fx-alerts` (P2) | หลัง `fx-ingest` | Edge Function | ส่ง email/push เมื่อแตะ threshold |

**Non-functional requirements**

| ด้าน | เป้า |
| --- | --- |
| Performance | LCP < 2.5 s บนมือถือ 4G, TTFB หน้า ISR < 200 ms, map API p95 < 300 ms |
| Availability | 99.9% (พึ่ง Vercel + Supabase Pro), FX/visa แสดงข้อมูลล่าสุดที่มีพร้อม timestamp เมื่อ job ล้ม |
| Security | RLS ทุกตาราง user data, service role ใช้เฉพาะ server, CSP เข้ม, rate limit endpoint เขียน |
| Privacy | ไม่เก็บข้อมูลพาสปอร์ต/สัญชาติ, analytics ไม่มี PII, ลบบัญชีแล้ว cascade ทั้งหมด |
| Accessibility | WCAG 2.2 AA, แผนที่มีมุมมองรายการ (list view) แทนสำหรับ screen reader |
| SEO | sitemap แยก places/dishes/visa, `hreflang` th/en, JSON-LD (`TouristAttraction`, `Restaurant`, `Recipe`-like สำหรับ dish) |
| Backup | Supabase PITR 7 วัน + dump รายสัปดาห์ไป storage แยก |

**Rollout phases**

1. **MVP (สัปดาห์ 1–6):** core modules, Home + Map (places อย่างเดียว, 3 เมือง: Sydney, Melbourne, Auckland), Currency, Dishes 30 รายการ, Visa helper, admin CRUD
2. **Phase 2 (สัปดาห์ 7–10):** Transit layer + GTFS sync, Prepare page เต็ม (trip, checklist, budget, share), search รวม
3. **Phase 3 (สัปดาห์ 11+):** FX alerts, PDF export, เพิ่มเมือง (Brisbane, Perth, Queenstown, Wellington), PWA offline สำหรับ checklist และ saved

**Open questions**

- [ ] เลือก FX provider ตัวไหน (ฟรี vs มี SLA) และ license อนุญาตแสดงต่อสาธารณะไหม
- [ ] Map tiles: MapTiler (จ่ายตาม request) หรือ self-host Protomaps บน R2
- [ ] ต้องการรองรับภาษาอื่นนอกจาก th/en ในอนาคตหรือไม่ (มีผลกับโครง `*_i18n`)

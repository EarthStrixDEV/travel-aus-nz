# TravelAusNZ Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the foundation up to the Oct 24 spec (59-table schema, new page map) and ship the Phase 1 pages: Destinations, Map, Eat & Drink, Gallery, Money, Visa & Entry, plus admin CRUD for their content.

**Architecture:** Public pages are SSG/ISR server components that read published rows through a cookie-less anon Supabase client wrapped in `unstable_cache` with per-module tags; admin publish calls `revalidateTag`. Interactive parts (map, filters, converter, visa helper) are client components fed by the page's ISR payload or by cached `GET /api/v1/*` Route Handlers. External data (FX, official links) only enters through Vercel Cron routes; no user request calls a third-party API.

**Tech Stack:** Existing (Next.js 15.5, next-intl 4, Supabase, Zod 4, Upstash, Vitest, pgTAP) + `maplibre-gl` (Map), `sharp` (admin upload placeholders). Image placeholders use Next `<Image placeholder="blur">` with a tiny base64 `blurDataURL` generated at upload and stored in `media_assets.blurhash` (no blurhash decoder in the browser).

**Spec:** `TravelAusNZ— Module & System Design.md` (§2–§11, §14, §15). Gap analysis: `docs/superpowers/plans/2026-10-25-gap-report.md`. Foundation plan (still binding where not overridden): `docs/superpowers/plans/2026-10-24-travelausnz-mvp-foundation.md`.

**Out of scope (Phase 2/3, separate plans):** Transport + OTP + `fare_rules` (§7), Signature Dishes (§9), Prepare (§12), My Trip + share/PDF/ICS (§13), newsletter (§4 Dispatch), `gtfs-sync`/`line-summary`/`stop-links`/`leg-recompute`/`content-stale`/`newsletter-send` jobs, PWA. Phase 1 seeds `transit_stops`/`place_stop_links` by hand for the three MVP cities.

## Global Constraints

- Everything in the foundation plan's Global Constraints still applies (locales `th`/`en`, `t()` fallback, error shape `{ error: { code, message } }`, Zod, cursor pagination, tokens, Prompt font, icons, motion, focus ring, theme cookie, analytics event allow-list).
- **Guest access (Earth, 2026-10-25): Task 11 stands.** No localStorage save, no `POST /api/v1/me/merge`, no guest "My Trip · N" counter. Save / Add to trip use `useRequireLogin`. Spec §3 "Guest-first state" and the guest parts of §2, §12, §13 are not built.
- **Routes (Earth, 2026-10-25): follow spec §2.** `/` · `/map` · `/transport` · `/eat-drink` · `/gallery` · `/dishes` · `/money` · `/visa` · `/prepare` · `/trip/[id]`. `/currency` is gone (no redirect needed — never shipped).
- Schema DDL copied verbatim from spec §14.1–14.8 except the deviations listed below.
- Caching (spec §3): content = ISR + `revalidateTag` on publish · FX latest = `Cache-Control: public, s-maxage=3600` · FX history `s-maxage=21600` · map places `s-maxage=600` · map transit `s-maxage=86400` · user data `no-store`.
- Rate limit (spec §3): only write + search + routing endpoints; `POST /api/v1/feedback` = 5 per hour per IP (`prefix: 'feedback'`).
- Prices always shown in local currency (A$ / NZ$); home-currency conversion only on Money and only client-side from one snapshot.
- Cron routes live under `/api/cron/*`, accept only `Authorization: Bearer ${CRON_SECRET}` (else 401), run on the Node runtime, and use `createServiceClient`.
- Visa: no passport / birth date / payment fields; helper answers never leave the browser; every result carries "Indicative, confirm on the official site"; official links open in a new tab with `rel="noopener noreferrer"`.
- Map tiles from `NEXT_PUBLIC_MAP_STYLE_URL` (MapTiler style, Earth's decision); FX via an `FxProvider` interface defaulting to exchangerate.host (Earth's decision).
- Every page in this plan is verified at 1440px and 390px, light and dark, against its artboard in `design/pages/`.

## Deviations from spec (confirm in review)

1. **Rewrite, don't alter.** No production database exists; the hosted **dev** project is disposable. Migrations `0002`–`0005` and `0007` are rewritten to the §14 schema and the dev DB is rebuilt with `supabase db reset --linked`. If a production project exists, stop and convert Task 1 into forward `alter`/`drop` migrations instead.
2. **Carried-over foundation deviations:** `is_editor()` for every editor policy, profiles select/update policies with `role` not user-writable, RLS on **all 59** tables (reference tables public-read + editor-write; `fx_snapshots`, `fx_daily` public-read; `link_checks`, `audit_log`, `content_feedback`, `newsletter_subscribers` RLS with no policies), audit + touch triggers on content tables.
3. **Missing FKs added:** `regions.cover_media_id`, `hero_slides.place_id`, `scenic_routes.cover_media_id`, `journeys.cover_media_id` → `media_assets` / `places`; `transit_agencies.card_id` → `transit_cards`; `permission_types.official_link_id` → `official_links`.
4. **`content_feedback.entity`** is free text from an anonymous endpoint: Zod caps it at 120 chars and `note` at 1000; `user_id` is set only when a session exists.
5. **`link-check` runs as a Vercel Cron route**, not a Supabase Edge Function, so Phase 1 has one job runtime (same as `fx-ingest`).
6. **`/prepare` stays gated** (Task 11 decision) even though spec §2 makes it public; revisit in the Prepare plan.

## Review Focus

1. Both FX providers fail and the newest snapshot is 7 h old → `GET /api/v1/fx/latest` answers 200 with that snapshot and `stale: true`; with no snapshot at all → 503 `{ error: { code: 'FX_UNAVAILABLE' } }` and the page shows the Error artboard, never a blank converter. Test: Task 7.
2. `GET /api/v1/map/places` with a malformed or huge `bbox` (`minLng > maxLng`, span > 40°, non-numeric) or `zoom` outside 0–22 → 400 `VALIDATION`, never a full-table scan or 500. Test: Task 4.
3. An `entry_rules` row whose `verified_at` is 31 days old (or whose permission has `needs_review`) → the helper shows no permission name, only the official-site button. Test: Task 8.
4. A venue with `is_closed = true` or `status <> 'published'` never appears in Eat & Drink lists, facets, Home dining edit, or Gallery "Nearby dining". Test: Task 5.
5. A cron route called without, or with a wrong, bearer token → 401 and no DB write. Test: Task 7 (shared helper, reused by Task 8).

---

### Task 1: Schema v2 (spec §14) + reference/dev seed + regenerated types

**Files:**
- Rewrite: `supabase/migrations/20261024000001_core.sql` (§14.1 + `handle_new_user`), `…0002_places.sql` → rename `…0002_transit.sql` (§14.3, first per spec migration order), `…0003_places.sql` (§14.2 + `is_open_now`), `…0004_dishes_fx_entry_prepare.sql` (§14.4–14.7), `…0005_trip.sql` (§14.8), `…0006_rls_audit.sql` (§14.9 + deviations 2–3), keep `…0006_media_bucket.sql` as `…0007_media_bucket.sql`, `…0008_reference_data.sql`
- Create: `supabase/migrations/20261024000009_map_places.sql` (RPC used by Task 4)
- Rewrite: `supabase/seed.sql` (dev-only sample content from the artboards, all prices tagged with `verified_at = null` so UIs show "Placeholder")
- Rewrite: `supabase/tests/schema.test.sql`, `rls.test.sql`, `audit.test.sql`, `is_open_now.test.sql`, `core.test.sql`
- Regenerate: `src/lib/supabase/database.types.ts` (`npm run db:types`)
- Modify: `src/app/[locale]/admin/cities/*` (cities gain `bbox`; regions gain `featured_rank`, `best_months`)

**Interfaces:**
- Produces: the 59 tables of §14 with the enums `place_type ('attraction','restaurant','bar','cafe','station','village')`, `transit_mode ('train','metro','tram','bus','coach','ferry','walk')`, `season`, `saved_entity ('place','dish','journey')`.
- Produces: `is_open_now(p_place uuid, p_at timestamptz) returns boolean` — unchanged behaviour.
- Produces: `map_places(min_lng float8, min_lat float8, max_lng float8, max_lat float8, p_zoom int, p_types place_type[]) returns jsonb` — `security invoker`, published + not closed only. `p_zoom < 13` → `{ "clusters": [{ neighbourhood, lng, lat, count }], "counts": {type: n} }` grouped by `neighbourhood_id` (centroid of member points); `>= 13` → `{ "features": GeoJSON FeatureCollection (≤ 500, props: slug, type, name_i18n), "counts": {...} }`.
- Reference data (`0008`, idempotent): regions/cities for Sydney, Melbourne, Auckland with `bbox`; currencies THB, USD, EUR, GBP, JPY, SGD, CNY, AUD, NZD (spec §10); `content_blocks` keys `money_tips`, `entry_timeline` with empty bodies.

- [ ] **Step 1: Write failing pgTAP tests**
  - `schema.test.sql`: `has_table` for all 59 names; `col_type_is('places','geom','geography(Point,4326)')`; `enum_has_labels('place_type', ARRAY[...6 labels])`.
  - `rls.test.sql`: every table in `public` has `relrowsecurity`; anon sees a published place but not a draft; anon cannot insert `content_feedback`/`fx_snapshots`; user A cannot select user B's `trips`, `trip_days`, `saved_items`; a user updating own `profiles.role` → permission denied.
  - `map_places`: 3 seeded places in two neighbourhoods at zoom 12 → 2 clusters, counts sum 3; zoom 14 → 3 features; a `is_closed` place → absent.
  - keep the existing `is_open_now` cases (Fri 18:00–02:00 bar, Sat 01:30, DST, Perth).
- [ ] **Step 2: Run `npm run test:db` — expect FAIL**
- [ ] **Step 3: Rewrite migrations + seed**, then `supabase db reset --linked` (dev project only — check `supabase/.temp/project-ref` is the dev ref first) and `npm run db:types`.
- [ ] **Step 4: Verify** — `npm run test:db` PASS; `npm test` PASS; `npm run build` PASS (admin cities compiles against new types).
- [ ] **Step 5: Commit** — `git commit -m "feat(db): schema v2 per spec §14 with RLS, audit, map_places"`

---

### Task 2: Page map — nav, tab bar, footer, gated paths, public data client

**Files:**
- Modify: `src/components/site/nav-items.ts`, `nav-items.test.ts`, `site-header.tsx`, `mobile-menu.tsx`, `mobile-tab-bar.tsx`, `site-footer.tsx`, `src/lib/auth/gated.ts`, `gated.test.ts`, `messages/{th,en}.json`
- Create: `src/lib/supabase/public.ts`, `src/lib/content/cache.ts`, `src/lib/content/cache.test.ts`

**Interfaces:**
- Produces: `type NavGroup = 'explore' | 'plan'`; `navItems: { key: NavKey; href: string; group: NavGroup }[]` — explore: `destinations /`, `map /map`, `transport /transport`, `eatDrink /eat-drink`, `gallery /gallery`; plan: `money /money`, `visa /visa`, `prepare /prepare` (union of the artboards' link sets, gap report §4). Groups are data only — artboards never render group headings; the mobile menu may. "My Trip" ghost button → `/trip` via `useRequireLogin`, no counter.
- Produces: `tabItems` per `HomeMobile.dc.html`: Discover `/` · Map `/map` · Transit `/transport` · Eat `/eat-drink` · Trip `/trip`; Money and Visa reached via the mobile menu.
- Header search icon + AU/NZ segment are rendered by the Home page (Task 3), not the shared header.
- Produces: `GATED_PREFIXES = ['/prepare', '/trip']`.
- Produces: `createPublicClient(): SupabaseClient<Database>` — anon key, `persistSession: false`, no cookies (safe inside `unstable_cache` and static pages). `import 'server-only'`.
- Produces: `CACHE_TAGS = { home, map, venues, gallery, fx, entry } as const` and `cachedContent<T>(key: string[], tag: keyof typeof CACHE_TAGS, fn: () => Promise<T>, revalidate = 3600): () => Promise<T>` wrapping `unstable_cache`.
- Footer: columns Explore / Plan per the new groups; still no newsletter form (Earth's earlier decision; Dispatch is a Home section in Phase 2).

- [ ] **Step 1: Write failing tests** — `nav-items.test.ts`: hrefs equal the list above; `isActive('/eat-drink/x','/eat-drink')` true; `gated.test.ts`: `/trip/abc` true, `/trips` false, `/prepare` true; `cache.test.ts` (mock `next/cache`): `cachedContent(['k'],'fx',fn)` calls `unstable_cache` with `{ tags: ['fx'], revalidate: 3600 }`.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**; rename message keys `nav.dishes→nav.eatDrink`, `nav.currency→nav.money`, add `nav.transport`, `nav.gallery`, `nav.group.explore|plan` (th + en identical key sets — `messages.test.ts` enforces).
- [ ] **Step 4: Verify** — `npm test`, `npm run lint`, `npm run build`; header/menu/tab bar at 1440/390 light/dark match `Main` and `HomeMobile`.
- [ ] **Step 5: Commit** — `git commit -m "feat(web): spec §2 page map in nav, tab bar, footer; public content client"`

---

### Task 3: Destinations (Home) — §4

**Files:**
- Create: `src/lib/content/home.ts` (+ `.test.ts`), `src/app/api/v1/home/route.ts`, `src/app/api/v1/journeys/route.ts`, `src/app/api/v1/journeys/[slug]/route.ts`, `src/app/api/v1/search/route.ts` (+ tests), `src/components/home/{hero-slider,search-bar,featured-regions,journey-cards,car-free-widget,dining-edit}.tsx`
- Modify: `src/app/[locale]/(site)/page.tsx`

**Interfaces:**
- Produces: `getHome(locale: Locale, country: 'au' | 'nz'): Promise<HomeData>` where `HomeData = { slides, regions, journeys, routeShowcase, diningEdit }` — published only; `regions` ordered by `featured_rank`, first = large, second = wide, rest small; `routeShowcase` = journey `kind='route_showcase'` with `journey_legs`; `diningEdit` = `collections.placement='home_dining'` → venues (excluding `is_closed`).
- Page: SSG for both countries (`generateStaticParams` × locale), country switch is client-side between two preloaded payloads; `revalidate` via tag `home`.
- `GET /api/v1/search?q=&region=&month=&interests[]=` — rate-limited; `q` 2–80 chars; returns `{ results: [{ kind: 'place'|'region'|'journey', slug, name, sub }] }` using `pg_trgm` similarity on `name_i18n->>locale`; analytics `track('search', { q_len })` client-side (no raw query).
- "Best Sep–Nov" label from `best_months` formatted with `Intl.DateTimeFormat(locale, { month: 'short' })`.
- Hero slider: 4 slides, autoplay off under reduced motion, pause button, `aria-roledescription="carousel"`.

- [ ] **Step 1: Write failing tests** — `home.test.ts` (mock client): draft region excluded; closed venue excluded from `diningEdit`; regions sorted by `featured_rank`. `search` route: `q=a` → 400 VALIDATION; rate-limit exceeded → 429.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement** per Interfaces; footer Acknowledgement already exists.
- [ ] **Step 4: Verify** — tests, lint, build (`/[locale]` stays ●); compare with `Main` and `HomeMobile` at 1440/390, light/dark; AU/NZ toggle swaps regions without a network request.
- [ ] **Step 5: Commit** — `git commit -m "feat(home): destinations page, journeys and search APIs"`

---

### Task 4: Interactive Map — §5

**Files:**
- Create: `src/app/[locale]/(site)/map/page.tsx`, `src/components/map/{map-canvas,layer-toggle,place-drawer,place-list,breadcrumb}.tsx`, `src/app/api/v1/map/places/route.ts`, `src/app/api/v1/map/transit/route.ts`, `src/app/api/v1/places/[slug]/route.ts`, `src/lib/content/places.ts` (+ tests for routes and `parseBbox`)

**Interfaces:**
- Produces: `parseBbox(s: string): [number, number, number, number] | null` — `minLng,minLat,maxLng,maxLat`; null when non-numeric, out of range, `min >= max`, or span > 40°.
- `GET /api/v1/map/places?bbox=&zoom=&types[]=` → calls `map_places` RPC; `s-maxage=600`.
- `GET /api/v1/map/transit?city_id=&modes[]=` → `{ lines: GeoJSON (shape, mode, short_name), stations: GeoJSON }`; `s-maxage=86400`.
- `getPlace(slug, locale)` → detail + up to 3 `place_stop_links` (stop name, `walk_min`, `walk_geom` as GeoJSON) + `is_open_now`; used by both the page drawer and `GET /api/v1/places/:slug` (ISR tag `map`).
- `MapCanvas` loads `maplibre-gl` with `next/dynamic` (`ssr: false`); layers distinguished by icon shape not colour; `PlaceList` is the accessible list view of the same results (WCAG, spec §15) toggled by a button; `AddToTrip`/Save go through `useRequireLogin` (Phase 1: signed-in action inserts `saved_items` via browser client, RLS owner policy).
- Analytics `place_view` with `{ slug }` when the drawer opens.
- Design-only UI (gap report §4): place search field filtering the loaded features client-side, zoom in/out + "My location" (`navigator.geolocation`, never sent to the server), overview card "Australia · N places" → "Open Sydney in detail", drawer Close + Share (`navigator.share` fallback copy link). Mobile uses the `MapMobile` bottom sheet "N places in view" with cards instead of the drawer.
- Cluster level follows the spec (neighbourhood) pending Earth's call on per-city overview clusters.

- [ ] **Step 1: Write failing tests** — `parseBbox`: valid Sydney bbox parses; `'151,-34,150,-33'`, `'a,b,c,d'`, `'100,-50,160,-10'` (span 60) → null. Route: bad bbox → 400 VALIDATION; `zoom=23` → 400; valid → RPC called with parsed numbers.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**; `npm i maplibre-gl`.
- [ ] **Step 4: Verify** — tests/lint/build; `Map` + `MapMobile` (bottom-sheet drawer) at 1440/390; layer toggles update counts; keyboard can reach every place via list view.
- [ ] **Step 5: Commit** — `git commit -m "feat(map): MapLibre map, clustered places API, place drawer with nearest stops"`

---

### Task 5: Eat & Drink — §8

**Files:**
- Create: `src/app/[locale]/(site)/eat-drink/page.tsx`, `src/components/venues/{venue-filters,venue-card,venue-drawer}.tsx`, `src/lib/content/venues.ts`, `src/lib/venues/filter.ts` (+ tests), `src/app/api/v1/venues/route.ts`, `src/app/api/v1/venues/[slug]/route.ts`

**Interfaces:**
- Produces: `getVenues(locale, city?: string): Promise<VenueCard[]>` — published, `is_closed = false`, joins `venues`, `cuisines`, `venue_drinks`, atmosphere tags, `place_hours`, first `place_stop_links`. Whole city catalog shipped with the page (spec: ≤ 300 per city).
- Produces: `filterVenues(list: VenueCard[], f: VenueFilter): { items: VenueCard[]; facets: Record<FacetKey, Record<string, number>> }` — `VenueFilter = { kind: 'restaurant'|'bar'; city?; priceMax?: 1|2|3|4; drink?; mood?; diet: string[]; cuisine? }`; diet is AND, others exact; facet counts computed for each facet with that facet's own filter removed.
- Filter state lives in the URL query (shareable), tab Restaurants/Bars with counts; drawer shows menu highlights, signature drinks, hours, nearest stop + walk, Save (gated), "On the map" → `/map?place=<slug>`.
- Tabs are Restaurants / Bars per spec. The design's third "Drinks" tab (winery, brewery, distillery…) needs new `place_type` values and a `spirits` drink — not built until Earth decides (gap report §4).
- `GET /api/v1/venues` mirrors `filterVenues` server-side with cursor pagination for when a city passes 300.

- [ ] **Step 1: Write failing tests** — `filter.test.ts`: `diet: ['vegan','gluten_free']` keeps only venues with both; `priceMax: 2` drops price 3; facet `cuisine` counts ignore the current cuisine selection; `getVenues` excludes `is_closed` (Review Focus 4).
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — tests/lint/build; compare with `Dining.dc.html`; empty filter result shows the design's empty state.
- [ ] **Step 5: Commit** — `git commit -m "feat(eat-drink): venue catalog, client filters with facets, detail drawer"`

---

### Task 6: Gallery — §6 (+ media rules)

**Files:**
- Create: `src/app/[locale]/(site)/gallery/page.tsx`, `src/components/gallery/{gallery-filters,masonry-grid,lightbox}.tsx`, `src/lib/content/gallery.ts`, `src/lib/gallery/filter.ts` (+ tests), `src/app/api/v1/gallery/route.ts`
- Modify: `src/lib/media/path.ts` (image URL + sizes helper)

**Interfaces:**
- Produces: `getGallery(locale): Promise<GalleryPhoto[]>` — each photo carries its place summary (`best_time_i18n`, `access_i18n`, ≤ 3 `place_nearby_venues` excluding closed) so the lightbox needs no second request.
- Produces: `filterGallery(list, { region?, type?, season? }): GalleryPhoto[]` preserving `sort`.
- Lightbox: native `<dialog>`, Prev/Next + `n / total` over the filtered list, arrow keys, Esc, focus return; "Open attraction page" → `/map?place=<slug>`; "Add to trip" gated.
- Images: `next/image` with `sizes` for 480/960/1920 widths, `placeholder="blur"` when `blurhash`-derived `blurDataURL` exists; masonry by `width/height` ratio.

- [ ] **Step 1: Write failing tests** — filter by `season: 'winter'` + `region` → intersection; no match → `[]` and grid renders "Nothing matches every filter"; lightbox at index 2 of filtered 3 → "3 / 3" and Next is disabled (no wrap); index 0 → Prev disabled.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — tests/lint/build; compare with `Gallery.dc.html` at 1440/390, light/dark.
- [ ] **Step 5: Commit** — `git commit -m "feat(gallery): filtered masonry gallery with place-backed lightbox"`

---

### Task 7: Money — §10 (+ `fx-ingest`, `fx-daily` jobs)

**Files:**
- Create: `src/lib/fx/{provider,exchangerate-host,frankfurter,rebase,ingest,convert}.ts` (+ tests), `src/lib/cron/auth.ts` (+ test), `src/app/api/cron/fx-ingest/route.ts`, `src/app/api/cron/fx-daily/route.ts`, `src/app/api/v1/fx/{latest,history,reference}/route.ts`, `src/app/[locale]/(site)/money/page.tsx`, `src/components/money/{converter,cross-rate,rate-trend,cost-table,budget-helper,money-tips}.tsx`, `vercel.json`

**Interfaces:**
- Produces: `interface FxProvider { name: string; fetchUsdRates(codes: string[]): Promise<Record<string, number>> }`; `exchangerateHost` (env `EXCHANGERATE_HOST_KEY`) primary, `frankfurter` backup.
- Produces: `rebaseToAud(usdRates): Record<string, number>` — `rate[X] = usd[X] / usd['AUD']`, includes NZD.
- Produces: `ingestFx(providers: FxProvider[], db): Promise<{ written: boolean; source?: string }>` — first provider that returns all 8 codes wins; all fail → no write.
- `fx-daily` (00:10 UTC): close = last snapshot of the previous UTC day per quote → upsert `fx_daily`; delete `fx_snapshots` older than 30 days.
- Produces: `requireCron(req: Request): NextResponse | null` — 401 unless bearer equals `CRON_SECRET`.
- `GET /fx/latest?base=AUD` → `{ base, rates, fetched_at, source, stale }`, `stale = now - fetched_at > 6h`; none → 503 `FX_UNAVAILABLE`.
- `GET /fx/history?pair=AUD-THB|NZD-THB…&range=7d|1m|3m|1y` → `{ points: [{ day, close }], high, low, change }`; NZD-based pairs derived `close(Q)/close(NZD)`.
- `GET /fx/reference` → cost items + budget presets + `money_tips` (ISR tag `fx`).
- Produces (client): `convert(amount: number, from: string, to: string, rates: Record<string, number>): number` — through AUD; `crossRate(rates)` = `rates.NZD`.
- Page states per artboards: loading skeleton (`CurrencyLoading`), error banner "use the last saved rates from {date}" when `stale` (`CurrencyError`), home currency default from profile or THB; `track('fx_convert', { from, to })` debounced. Also from the artboards: "Rates unavailable. Try again" retry button (503 path), AUD/NZD pair toggle on the trend, cross-rate quick rows A$100/500/1000 → NZ$, disclaimer "Indicative mid-market rates. Not for financial transactions.", sticky converter on mobile.
- `vercel.json` crons: `/api/cron/fx-ingest` `0 * * * *`, `/api/cron/fx-daily` `10 0 * * *`.

- [ ] **Step 1: Write failing tests** — `rebase`: `{AUD:0.65, THB:23.4, NZD:0.59}` → `THB ≈ 36`, `NZD ≈ 0.9077`; `ingest`: primary throws, backup ok → written with backup source; both throw → `written: false`, no insert; `latest` route: snapshot 7 h old → 200 `stale: true`; none → 503 (Review Focus 1); `requireCron`: missing/wrong token → 401 (Review Focus 5); `convert(1000,'THB','NZD',rates)` matches hand-computed value to 2 dp.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — tests/lint/build; `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/fx-ingest` writes one row; page matches `Currency*` artboards (desktop/mobile, light/dark, loading, error); typing in the converter makes no network request.
- [ ] **Step 5: Commit** — `git commit -m "feat(money): FX ingest with fallback provider, rates APIs, converter page"`

---

### Task 8: Visa & Entry — §11 (+ `link-check` job)

**Files:**
- Create: `src/lib/entry/{helper,link-check}.ts` (+ tests), `src/lib/content/entry.ts`, `src/app/api/v1/entry/route.ts`, `src/app/api/v1/feedback/route.ts` (+ test), `src/app/api/cron/link-check/route.ts`, `src/app/[locale]/(site)/visa/page.tsx`, `src/components/visa/{country-tabs,entry-helper,permission-types,timeline,documents-checklist,scams,faq}.tsx`
- Modify: `vercel.json` (`/api/cron/link-check` `0 2 * * *`)

**Interfaces:**
- Produces: `resolveEntry(rules, permissions, answers: { nationality: string | 'not_listed'; purpose: 'tourism'|'work_study'; stay: 'lt1'|'1to3'|'gt3' }, country: 'AU'|'NZ', today: Date): EntryResult` where `EntryResult = { kind: 'permission'; permission } | { kind: 'official_only'; link } | { kind: 'work_study'; link } | { kind: 'not_listed'; link }`. `official_only` when the rule or permission `verified_at` is null/older than 30 days or `needs_review`.
- Helper runs fully client-side on the ISR payload from `getEntry()`; mobile steps 1–3 + loading + result per `VisaMobile*`; result text always ends with the indicative disclaimer; CTA click → `track('visa_official_click', { country })`.
- Documents checklist "n of m ready" stored in `localStorage` key `tanz:v1:visa-docs` (device-only, not a saved item — allowed under Task 11 because nothing is synced) + Print via `window.print()` with a print stylesheet.
- Permission fields with null `verified_at` show a "Placeholder" tag.
- From the artboards: "Official sources" list (from `official_links`), lead-time bars per permission rendered from `content_blocks.entry_timeline`, "Keep planning" links (Prepare / Money / Transport), mobile Back/Next. Not in the design but required by spec: a small "Report outdated info" link per permission opening the feedback form, and the page-level `last_verified_at` date.
- `POST /api/v1/feedback` body `{ entity: string ≤120, kind: 'outdated'|'broken'|'unclear', note?: string ≤1000 }` → 202; inserts with service client; rate limit 5/h/IP.
- Produces: `checkLinks(db, fetchImpl)` — per `official_links` row: GET with 10 s timeout, store `link_checks`; hash of `<title>`; status ≥ 400 or hash change on two consecutive checks → `health_status` broken/changed and `needs_review = true` on referencing `permission_types` + `entry_rules`.

- [ ] **Step 1: Write failing tests** — `resolveEntry`: TH/tourism/lt1 verified 5 days ago → permission; same rule verified 31 days ago → `official_only` (Review Focus 3); `work_study` → `work_study`; `not_listed` → `not_listed`. `link-check`: one 404 → not yet flagged; second consecutive 404 → `needs_review` set. Feedback: 6th request in an hour → 429; `kind: 'spam'` → 400.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — tests/lint/build; DevTools network tab shows no request while using the helper; compare with `Visa*` artboards (empty helper, result, mobile, loading, dark).
- [ ] **Step 5: Commit** — `git commit -m "feat(visa): client-side entry helper, entry API, feedback, link-check job"`

---

### Task 9: Admin CRUD for Phase 1 content

**Files:**
- Create: `src/app/[locale]/admin/{regions,places,gallery,hero,journeys,collections,entry,fx-reference}/…` (list + `[id]` edit + `actions.ts` + `schema.ts` each, following `admin/cities`), `src/app/[locale]/admin/media/upload.ts`
- Modify: `src/app/[locale]/admin/admin-nav.tsx`, messages (`admin.*`)

**Interfaces:**
- Consumes: `requireRole`, `citySchema` pattern, `CACHE_TAGS` (Task 2).
- Each `save<Entity>` action: `requireRole(['editor','admin'])`, Zod parse (th + en fields), upsert through the user's session (RLS + audit), then `revalidateTag` — places/venues → `map`, `venues`, `home`; gallery → `gallery`; hero/journeys/collections/regions → `home`; entry → `entry`; fx reference → `fx`.
- Places form includes the venue sub-form when `type` ∈ restaurant/bar/cafe, hours editor (weekday rows), tags, and nearest-stop links (manual in Phase 1).
- Media upload: Storage bucket from foundation Task 4; `credit` and `license` required before an asset can be referenced by published content (Zod refine on publish); `blurDataURL` generated server-side at upload (sharp resize to 8 px, base64) and stored in `media_assets.blurhash`.
- Review queue page lists rows with `needs_review = true` (entry) and unresolved `content_feedback`.

- [ ] **Step 1: Write failing tests** — one `schema.test.ts` per entity: missing `name_en` fails; place publish with media lacking `license` fails; slug pattern enforced. Action test (mock client): saving a place calls `revalidateTag` with `map`, `venues`, `home`.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — tests/lint/build; as an editor publish a place → it appears on `/map` and `/eat-drink` without redeploy; audit log shows the rows.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): CRUD and publish revalidation for Phase 1 content"`

---

### Task 10: SEO — sitemap, hreflang, JSON-LD

**Files:**
- Create: `src/app/sitemap.ts` (index) + `src/app/sitemaps/[kind]/route.ts` for `destinations`, `venues`, `gallery` (dishes added in Phase 2), `src/lib/seo/jsonld.ts` (+ test), `src/app/robots.ts`
- Modify: page `generateMetadata` in Tasks 3–8 pages (`alternates.languages` th/en)

**Interfaces:**
- Produces: `placeJsonLd(place, locale): object` → `TouristAttraction` | `Restaurant` | `BarOrPub` by `type`, with `geo`, `address` area, `openingHoursSpecification` from `place_hours`, `priceRange` from `price_level` (`$`–`$$$$`).
- Every public page: `alternates: { languages: { th: '/th/...', en: '/en/...' } }`.

- [ ] **Step 1: Write failing tests** — bar → `@type: 'BarOrPub'`; Fri 18:00–02:00 hours → one spec entry with `opens: '18:00'`, `closes: '02:00'`; `price_level 3` → `'$$$'`.
- [ ] **Step 2: Run `npm test` — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify** — `npm run build`; `/sitemap.xml` lists the three sitemaps; Rich Results test on one venue page passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(seo): sitemaps, hreflang, JSON-LD for places"`

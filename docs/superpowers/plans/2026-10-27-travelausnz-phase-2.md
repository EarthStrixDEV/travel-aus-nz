# TravelAusNZ Phase 2 Implementation Plan — remaining pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship every page still missing from spec §2: Transport (`/transport`), Signature Dishes (`/dishes`, `/dishes/[slug]`), Prepare (`/prepare`) and My Trip (`/trip`, `/trip/[id]`, shared view), plus admin CRUD for their content. Before that, close the four Phase 1 review fixes Earth deferred.

**Architecture:** Same as Phase 1: public content is ISR server components reading published rows through `createPublicClient()` inside `cachedContent()` with per-module tags, and admin saves call `revalidateTag`. Transport is the one page that calls a third party during a request. It goes through a `RoutingProvider` interface, with Google Routes API as the only implementation for now, behind a 15-minute Upstash cache and a rate limit. User data (checklist, packing, trips, stops, legs, saved) is read and written through `/api/v1/me/*` Route Handlers using the session client, so RLS stays the guard, and every response is `no-store`. Leg recompute runs after the response with Next `after()`, and a cron sweep catches anything left `stale`.

**Tech Stack:** Existing stack (Next.js 15.5, next-intl 4, Supabase, Zod 4, Upstash, Vitest, pgTAP, maplibre-gl). One new external service: **Google Routes API** (`routes.googleapis.com/directions/v2:computeRoutes`, server-side key `GOOGLE_ROUTES_API_KEY`). No new npm dependencies.

**Spec:** `TravelAusNZ— Module & System Design.md` §2, §3, §7, §9, §12, §13, §14.3/14.4/14.7/14.8, §15. Prior plans still bind where not overridden: `2026-10-24-travelausnz-mvp-foundation.md`, `2026-10-25-travelausnz-phase-1.md`. Design: `design/pages/{Transport,Dishes*,DishDetail*,DishFiltersMobile,Prepare*,Trip}.dc.html`.

**Decisions (Earth, 2026-10-27):**
1. **Routing = Google Routes API**, behind a `RoutingProvider` interface so OTP can replace it later without touching callers. No OTP VM, no `gtfs-sync` in this plan.
2. **Scope = all four pages** in one plan. Newsletter, PWA and extra cities stay out.
3. **Login gating stays** (Phase 1 Task 11): `/prepare` and `/trip` remain in `GATED_PREFIXES`; no localStorage checklist, no `POST /me/merge`, no guest counter.
4. **Phase 1 deferred fixes go first** as Task 0.

**Out of scope:** OTP self-host, `gtfs-sync`, `stop-links` (OSRM), `content-stale`, newsletter / Dispatch + `newsletter-send`, PWA offline, Brisbane/Hobart/Queenstown/Wellington/Rotorua content, guest-first state.

## Global Constraints

- Everything in the Phase 1 Global Constraints still applies (locales, `t()` fallback, error shape `{ error: { code, message } }`, Zod via `parseQuery`/`parseBody`, `apiError`, tokens, analytics allow-list, cron bearer via `requireCron`, prices in A$/NZ$, verify each page at 1440/390 light/dark against its artboard).
- `CACHE_TAGS` gains `transport`, `dishes`, `prepare`. Trip data is never cached (`Cache-Control: no-store`).
- `GOOGLE_ROUTES_API_KEY` is read only in `src/lib/routing/google.ts` (`import 'server-only'`) and is never sent to the browser. Earth sets an API-key restriction (Routes API only) and a daily quota cap in Google Cloud before production.
- Rate limits (spec §3): `GET /api/v1/routes/plan` = 20 per 10 min per IP (`prefix: 'routes'`); every `/api/v1/me/*` write = 60 per min per user (`prefix: 'me'`).
- `/api/v1/me/*` routes call `requireUser()` first (401 `UNAUTHENTICATED` otherwise) and use the session client from `src/lib/supabase/server.ts`, never the service client. A row the user doesn't own answers **404**, not 403, so it gives nothing away.
- Every `transit_mode` value maps to one icon and one label key (`transport.mode.*`); `walk` included.

## Deviations from spec (confirm in review)

1. **Google Routes instead of OTP** (spec §7). Google has no ferry filter and no wheelchair routing, so:
   - The request always asks for all transit modes. Mode chips filter the returned options **after** the call (an option is dropped if any of its transit legs uses an unchecked mode). Vehicle type maps: `BUS|INTERCITY_BUS|TROLLEYBUS→bus`, `HEAVY_RAIL|COMMUTER_TRAIN|HIGH_SPEED_TRAIN|LONG_DISTANCE_TRAIN|RAIL→train`, `SUBWAY|METRO_RAIL→metro`, `TRAM|LIGHT_RAIL→tram`, `FERRY→ferry`, everything else `→bus`.
   - **Step-free** is our own post-filter: each transit leg's board and alight stop must match a `transit_stops` row within 75 m with `step_free = true`. An unknown stop counts as not step-free. The UI says "Step-free based on our stop data — check with the operator".
   - `computeAlternativeRoutes: true` gives up to 3 options. Fewer than 3 is a normal result, not an error.
2. **Fares come from `fare_rules` only.** Supported rule shapes are `{ kind: 'flat', peak, offpeak }` and `{ kind: 'distance', bands: [{ upto_km, peak, offpeak }], daily_cap? }`. Zone fares are not modelled because we have no stop-zone data. An agency with no rule (or one that matches no agency) gives `fare_min = fare_max = null`, and the UI shows "Check fare with operator". Agency match: Google `transitLine.agencies[0].name` ↔ `transit_agencies.name`, case-insensitive.
3. **`line_service_summary` is editorial** for the three Phase 1 cities, entered in admin. There is no GTFS job, so `computed_at` = save time.
4. **PDF = print stylesheet.** Prepare "Save as PDF" and My Trip "Export → PDF" use `window.print()` with a print CSS (same as Visa docs), not server-rendered PDF. `GET …/checklist.pdf` is not built. **ICS is generated server-side** (plain text, no dependency).
5. **Leg recompute uses `after()` + cron sweep** instead of `pgmq` + Edge Function: mutations mark legs `stale`, `after()` recomputes them, and `/api/cron/leg-recompute` (every 15 min) retries rows still `stale` older than 2 min (max 50 per run, `failed` after 3 tries via a new `attempts` column).
6. **Prepare needs a trip** because `trip_checklist_items` / `trip_packing_items` key on `trip_id`. Prepare uses the user's most recent non-deleted trip. If there is none, the first toggle creates one titled "My trip" (no dates).
7. **Shared trip URL is `/shared/[token]`**, outside the gated `/trip` prefix, and renders read-only through the service client after the token check.
8. **`/dishes` is not added to the header nav** (spec §2 nav groups don't list it). It's reached from Eat & Drink, Home and Prepare "Keep planning", and listed in the sitemap.
9. **Design gaps (gap report §4 Phase 2/3), defaults taken:** Dishes `type` stays single-valued; country filter has AU / NZ only (no "both"). Transport no-result and 503 states use the Map empty-state pattern. Prepare fact icons are a fixed icon key per `facts` item in `content_blocks`. My Trip has no drag: "Move up/down" buttons + "Add to Day n" only; `off_map` is a boolean computed server-side.

## Review Focus

1. Google Routes times out (8 s), returns non-2xx, or the key is missing → `GET /routes/plan` answers **503 `ROUTING_UNAVAILABLE`** plus a `fallback` curated journey when `journeys.from_name`/`to_name` match, never a 500 or a hang. Test: Task 1.
2. The same `from`/`to`/`depart` within the same 15-minute bucket → **one** upstream call (cache key = sha256 of normalised from/to lat-lng to 4 dp + bucket). Rate limit 21st call → 429 before any upstream call. Test: Task 1.
3. User A calling any `/me/trips/:id`, `/me/stops/:id`, `/me/checklist-items/:id` with user B's id → **404 and no write**. Test: Task 5 (pgTAP RLS + route tests).
4. A revoked or unknown share token → 404. The shared payload contains **no** `user_id`, email, trip `id` or note fields marked private. Test: Task 7.
5. A `dish_venues` row whose place is `is_closed` or not published never appears in "Where to try" or the dish API. A dish detail with `allergy_i18n` always renders the "ask the venue" warning. Test: Task 3.
6. Link-check never fetches a non-`https` or non-`gov.au`/`govt.nz` URL, including via redirect. Test: Task 0.

---

### Task 0: Phase 1 deferred fixes

Source: `.superpowers/sdd/2026-10-25-travelausnz-phase-1/final-findings.md` items 1, 3, 4, 5 (item 2 already landed in `95366fa`).

**Files:**
- Modify: `src/lib/entry/link-check.ts`, `src/app/[locale]/admin/entry/{actions,schema}.ts` and the link edit page, `src/components/map/map-canvas.tsx` (+ map page list-only mode), `.env.example`, `next.config.ts`, `src/app/[locale]/admin/media/{schema,upload}.ts` + upload form, `messages/{th,en}.json`
- Tests: existing RED `src/lib/entry/link-check.test.ts`, `src/app/[locale]/admin/entry/schema.test.ts` (already in the working tree), plus `actions.test.ts`, a map-canvas component test, a media schema test

**Interfaces:**
- `isAllowedOfficialUrl(url: string): boolean`: `https:` and hostname equals or ends with `.gov.au` / `.govt.nz` (exact suffix, so `evilgov.au` is rejected). Used by `checkLinks` and the official-link Zod schema.
- `checkLinks`: `redirect: 'manual'`, follows ≤ 5 redirects itself and re-checks each `Location`; an off-list redirect is recorded as broken and not fetched; body read capped at 1 MB.
- `saveOfficialLink`: URL changed → `content_hash: null`, `health_status: 'ok'`. New action `acceptOfficialLinkPage(id)` (requireRole first) clears `content_hash` and sets `ok`.
- Map: `map.on('error')` before `load`, or a 10 s timeout → list-only mode using the selected city's bbox. `.env.example` map style line becomes empty.
- `MAX_UPLOAD_BYTES = 4 * 1024 * 1024`; `bodySizeLimit: '4.5mb'`; localized "File too large (max 4 MB)" checked client-side before submit and server-side.

- [ ] **Step 1: Write failing tests**: off-list host not fetched; redirect to off-list host not followed; allowlisted redirect followed; `https://evilgov.au` rejected by the schema; URL change resets the hash; accept action clears it; map error → list rendered; 4.1 MB file rejected.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: `npm test`, `npm run lint`, `npm run build`; with a bad `NEXT_PUBLIC_MAP_STYLE_URL` the map page shows the list within 10 s.
- [ ] **Step 5: Commit**: `git commit -m "fix: link-check SSRF allowlist, accept official link changes, map error fallback, 4 MB upload cap"`

---

### Task 1: Routing module + `GET /api/v1/routes/plan` (§7 routing flow)

**Files:**
- Create: `src/lib/routing/{types,provider,google,fares,plan,cache}.ts` (+ tests), `src/app/api/v1/routes/plan/route.ts` (+ test)
- Modify: `.env.example` (`GOOGLE_ROUTES_API_KEY=`), `src/lib/api/errors.ts` (`ROUTING_UNAVAILABLE`)

**Interfaces:**
- `type RouteLeg = { mode: TransitMode; from: string; to: string; depart: string; arrive: string; duration_min: number; detail: string; agency?: string; distance_m: number; board?: Point; alight?: Point }`
- `type RouteOption = { depart: string; arrive: string; duration_min: number; summary: string; fare_min: number | null; fare_max: number | null; currency: 'AUD' | 'NZD'; card: string | null; legs: RouteLeg[] }`
- `interface RoutingProvider { name: string; plan(input: { from: Point; to: Point; departUtc: Date }): Promise<RouteOption[]> }` returns options **without** fares or cards; throws `RoutingUnavailable` on timeout / non-2xx / missing key.
- `googleRoutes: RoutingProvider`: POST `computeRoutes`, `travelMode: 'TRANSIT'`, `computeAlternativeRoutes: true`, `X-Goog-FieldMask` limited to the fields mapped, 8 s `AbortSignal.timeout`. Mapping: steps → legs, merging consecutive walk steps and dropping walk legs < 2 min (spec §7 step 4).
- `applyFares(options, rules, agencies, cards, departLocal): RouteOption[]`: off-peak by the agency's rule window → `fare_min`, peak → `fare_max`, daily cap clamps; `card` = `transit_cards.name` (+ "or contactless" when `contactless`).
- `planRoute(input, deps): Promise<{ options: RouteOption[] } | { error: 'ROUTING_UNAVAILABLE'; fallback: JourneyCard | null }>`: resolves `from`/`to` (place slug → `places.geom`, or `lat,lng` inside the AU/NZ envelope), converts `depart` (local `YYYY-MM-DDTHH:mm`) with the from-city's `cities.timezone`, rounds to 15 min, reads/writes Redis `route:{sha256}` with 900 s TTL, then filters by `modes[]` and `step_free` (deviation 1) **after** the cache, so filters never spend upstream calls.
- Route: `GET /api/v1/routes/plan?from&to&depart&modes[]&step_free` → 200 `{ options }` · 400 `VALIDATION` · 429 · 503 `{ error, fallback }`. `Cache-Control: no-store` (Redis is the cache).

- [ ] **Step 1: Write failing tests**: Google fixture JSON → 2 options with merged walk legs; ferry leg mapped to `ferry`; fetch rejects / 500 / timeout → 503 with matching fallback journey (Review Focus 1); second identical call in the same bucket → provider called once (Review Focus 2); 21st request → 429 and provider not called; `modes=train` drops an option containing a bus leg; step-free drops an option whose board stop has `step_free = null`; distance rule 12 km off-peak → `fare_min` from the right band; unknown agency → fares null.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build; with a real key, `curl "localhost:3000/api/v1/routes/plan?from=central-station&to=bondi-beach&depart=2026-11-02T09:00"` returns 1–3 options; a repeat call does not hit Google (log line once).
- [ ] **Step 5: Commit**: `git commit -m "feat(routing): Google Routes provider, fares, cached route plan API"`

---

### Task 2: Transport page — §7

**Files:**
- Create: `src/lib/content/transport.ts` (+ test), `src/app/api/v1/transit/cities/[city]/lines/route.ts`, `src/app/api/v1/transit/scenic/route.ts`, `src/app/api/v1/transit/cards/route.ts`, `src/app/[locale]/(site)/transport/page.tsx`, `src/components/transport/{journey-planner,route-options,route-legs,line-explorer,scenic-routes,cards-passes}.tsx`
- Modify: `src/lib/content/cache.ts` (`transport` tag), `messages/{th,en}.json` (`transport.*`)

**Interfaces:**
- `getTransport(locale): Promise<{ cities: { slug, name }[]; scenic: ScenicCard[]; cards: CardInfo[]; tips: string | null }>`, cached with tag `transport`; scenic `status = 'published'` only; `tips` from `content_blocks` key `transport_tips`.
- `getCityLines(citySlug, mode?)` → `{ lines: [{ short_name, long_name, mode, stops: string[], end_to_end_min, headway_peak_min, headway_offpeak_min, fare_min, fare_max }] }`, `s-maxage=86400`.
- `/transit/scenic?country=AU|NZ` and `/transit/cards?city=` are thin wrappers over the same loaders (ISR tag `transport`).
- Planner (client): from/to text inputs with place autocomplete reusing `GET /api/v1/search` (`kind = 'place'`), depart datetime (default now in the selected city), mode chips Train/Tram/Bus/Ferry, "Step-free routes only", **Find routes** → `/routes/plan`. Query params mirror state (`?from=&to=&depart=`) so Prepare airport transfers can deep-link (Task 4). States: idle, loading skeleton, results (option 1 selected, legs panel), no result, 503 banner + curated journey card, 429 "Too many searches, try again in a few minutes".
- `track('route_plan', { modes_count, step_free })` (add to the analytics allow-list; no from/to).

- [ ] **Step 1: Write failing tests**: `transport.test.ts` (mock client): draft scenic route excluded; lines sorted by mode then short name; a line without a summary row still listed with nulls. Component: 503 response renders the fallback card; submitting with empty `to` shows a field error and makes no request.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build; `/en/transport` and `/th/transport` return 200; compare with `Transport.dc.html` at 1440, then build 390 + dark from tokens (no artboard, gap report §4); keyboard-only run through the planner.
- [ ] **Step 5: Commit**: `git commit -m "feat(transport): journey planner, line explorer, scenic routes, cards"`

---

### Task 3: Signature Dishes — §9 (+ dishes sitemap)

**Files:**
- Create: `src/lib/content/dishes.ts` (+ test), `src/lib/dishes/filter.ts` (+ test), `src/app/api/v1/dishes/route.ts`, `src/app/api/v1/dishes/[slug]/route.ts`, `src/app/[locale]/(site)/dishes/page.tsx`, `src/app/[locale]/(site)/dishes/[slug]/page.tsx`, `src/components/dishes/{dish-filters,filter-sheet,must-try,dish-grid,dish-collections,dish-detail,where-to-try}.tsx`
- Modify: `src/lib/content/cache.ts` (`dishes` tag), `src/lib/seo/sitemap.ts` (`dishes` kind), `src/app/sitemaps/[kind]/route.ts`, `messages/{th,en}.json` (`dishes.*`)

**Interfaces:**
- `getDishes(locale)` → `{ dishes: DishCard[]; mustTry: DishCard[] (must_try_rank 1–3); collections: [{ slug, title, sub, count, previews: DishCard[3] }] }`, published only, tag `dishes`, whole catalog sent once (spec: client filters).
- `filterDishes(dishes, { country?, region?, type?, priceMax?, diet[] })` + `dishFacetCounts(...)` for the mobile "Show n dishes" button. Filter state in the URL like `parseVenueFilter`.
- `getDish(slug, locale, regionSlug?)` → detail + `pairings` + `venues` (≤ 3 for the region, else the nearest region with venues), each venue with nearest stop from `place_stop_links`. Venues with `is_closed` or unpublished places are excluded (Review Focus 5).
- `/dishes/[slug]`: `generateStaticParams` for published slugs × locales, `notFound()` otherwise; Save uses `useSavedPlaces`-style hook generalised to `entity_type: 'dish'`; "Open map" → `/map?place=<venue slug>`.
- Allergy block always ends with `dishes.allergyWarning` ("Always confirm with the venue"), even when `allergy_i18n` is empty.

- [ ] **Step 1: Write failing tests**: closed / draft venue excluded from detail venues; region with no venues falls back to the nearest region; `diet=['vegan','gluten_free']` keeps only dishes containing both; facet counts match filtered length; sitemap includes `/en/dishes/<slug>` and `/th/dishes/<slug>`.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build (`/[locale]/dishes/[slug]` is ●); compare with `Dishes*`, `DishDetail*`, `DishFiltersMobile` (desktop/mobile, light/dark, empty state).
- [ ] **Step 5: Commit**: `git commit -m "feat(dishes): signature dishes catalog, detail, filters, sitemap"`

---

### Task 4: Prepare — §12 (login-gated)

**Files:**
- Create: `src/lib/content/prepare.ts` (+ test), `src/lib/trip/current-trip.ts` (+ test), `src/app/api/v1/prepare/route.ts`, `src/app/api/v1/me/trips/[id]/checklist/route.ts`, `src/app/api/v1/me/checklist-items/[id]/route.ts`, `src/app/api/v1/me/trips/[id]/packing/route.ts`, `src/app/api/v1/me/packing-items/[id]/route.ts` (+ route tests), `src/app/[locale]/(site)/prepare/page.tsx`, `src/components/prepare/{progress-bar,checklist,country-tabs,best-time,packing-guide,facts,connectivity,health,airport-transfers,keep-planning}.tsx`, print CSS
- Modify: `src/lib/content/cache.ts` (`prepare` tag), `messages/{th,en}.json` (`prepare.*`)

**Interfaces:**
- `getPrepare(locale, country: 'AU'|'NZ'|'both')` → `{ templates (by moment 3m/1m/1w/day0, filtered by applies_to), months: region × 12 (comfort, crowds, recommended), packing (by season, grp), facts, connectivity, health, transfers }`, tag `prepare`. Rows with null `verified_at` on cost/fare fields render the "Placeholder" tag.
- `currentTripId(db, userId, { create: boolean }): Promise<string | null>`: newest trip with `deleted_at is null`; creates "My trip" only when `create` (deviation 6).
- `GET /me/trips/:id/checklist` → `{ items: [{ template_id, done }] }`; `PATCH /me/checklist-items/:templateId` body `{ trip_id, done }` upserts `trip_checklist_items` (`done_at` set/cleared). Same pair for packing (`packed`). All `no-store`, rate-limited, 404 on a trip not owned (Review Focus 3).
- Page: server component loads content (ISR data) + the user's ticks (dynamic, session). Sticky progress "n of m ready", "Next up" = first unticked by moment order, Reset (confirm in-page, not `window.confirm`), Save as PDF = `window.print()`. Airport transfer "Route details" → `/transport?from=<airport place slug>&to=<city centre slug>`.
- `track('checklist_toggle', { moment })`.

- [ ] **Step 1: Write failing tests**: `prepare.test.ts`: NZ tab excludes AU-only templates; months return 12 rows per region. `current-trip`: no trip + `create: false` → null; `create: true` → inserts once (second call reuses). Routes: PATCH another user's trip → 404 and no write; unauthenticated → 401.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build; log in, tick 3 items, reload → still ticked; compare with `Prepare*` (desktop/mobile, light/dark); print preview shows the checklist only.
- [ ] **Step 5: Commit**: `git commit -m "feat(prepare): checklist, packing, seasons, facts, transfers (signed-in)"`

---

### Task 5: My Trip core — trips, days, stops, saved — §13

**Files:**
- Create: `supabase/migrations/20261027000001_trip_ops.sql` (+ `supabase/tests/trip.test.sql`), `src/lib/trip/{schema,load,off-map}.ts` (+ tests), `src/app/api/v1/me/trips/route.ts`, `src/app/api/v1/me/trips/[id]/route.ts`, `src/app/api/v1/me/trips/[id]/days/[day]/stops/route.ts`, `src/app/api/v1/me/stops/[id]/route.ts`, `src/app/api/v1/me/saved/route.ts`, `src/app/api/v1/me/summary/route.ts` (+ route tests), `src/app/[locale]/(site)/trip/page.tsx`, `src/app/[locale]/(site)/trip/[id]/page.tsx`, `src/components/trip/{trip-header,new-trip-form,day-tabs,stop-list,leg-row,day-map,off-map-card,saved-unscheduled}.tsx`
- Modify: `src/components/trip/use-saved-places.ts` → generalise to `useSaved(entityType, ids)` (place / dish / journey), `messages/{th,en}.json` (`trip.*`)

**Interfaces:**
- Migration: `trip_legs.attempts smallint default 0`; `unique (day_id, position) deferrable initially deferred` on `trip_stops`; RPC `move_trip_stop(p_stop uuid, p_day uuid, p_position smallint)` (`security invoker`, renumbers positions in one transaction, marks the legs around the old and new position `stale`); RPC `create_trip(p_title, p_start, p_end)` inserts `trips` + one `trip_days` row per date (no dates → Day 1 only).
- `POST /me/trips` `{ title ≤ 80, start_date?, end_date? (≤ 60 days) }` → trip + days. `GET /me/trips` → list. `GET /me/trips/:id` → `{ trip, days: [{ ..., stops: [{ ..., place, leg_to_next }] , transit_min, off_map }], saved_unscheduled }`. `PATCH /me/trips/:id` title/dates; `DELETE` → soft delete (`deleted_at`).
- `POST /me/trips/:id/days/:day/stops` `{ place_id, time?, note? ≤ 280 }` appends a stop and marks the new leg(s) `stale`. `PATCH /me/stops/:id` `{ time?, note?, day_id?, position? }` (move via RPC). `DELETE /me/stops/:id` → 204; the place stays in `saved_items` (inserted if missing) so it shows under "Saved, not scheduled".
- `GET/POST/DELETE /me/saved` `{ entity_type, entity_id }`; `GET /me/summary` → `{ saved_count, latest_trip_id }` (header "My Trip" link goes to the latest trip, else `/trip`).
- `isOffMap(stops, cityBbox)`: true when any stop lies outside the main city's bbox → `trip_days.off_map` updated on every stop mutation; UI shows the summary card instead of the map.
- `/trip`: list + "New trip" form; `/trip/[id]`: day tabs (`?day=n`), stop list with Move up/down, remove, time/note edit, leg rows showing "calculating…" while `stale` and "Couldn't calculate" + retry when `failed`, summary "n stops · m min in transit", day map reusing MapLibre with numbered pins.

- [ ] **Step 1: Write failing tests**: pgTAP: user B can't select/update user A's `trip_stops` / `trip_legs`; `move_trip_stop` keeps positions contiguous and marks both neighbour legs stale. Routes: other user's trip id → 404 (Review Focus 3); end_date before start_date → 400; deleting a stop leaves a `saved_items` row. `isOffMap`: Blue Mountains stop with Sydney bbox → true.
- [ ] **Step 2: Run `npm test` + `npm run test:db` and expect FAIL**
- [ ] **Step 3: Implement**, then `supabase db push` to the dev project and `npm run db:types`.
- [ ] **Step 4: Verify**: tests/lint/build; create a 3-day trip, add 4 saved places to Day 1, move one to Day 2, delete one → it appears under Saved; compare with `Trip.dc.html` at 1440, then build 390 + dark from tokens.
- [ ] **Step 5: Commit**: `git commit -m "feat(trip): trips, days, stops, saved items and trip page"`

---

### Task 6: Leg recompute — §13

**Files:**
- Create: `src/lib/trip/legs.ts` (+ test), `src/app/api/cron/leg-recompute/route.ts` (+ test)
- Modify: the Task 5 stop routes (schedule `after(() => recomputeStaleLegs(tripId))`), `vercel.json` (`/api/cron/leg-recompute` `*/15 * * * *`)

**Interfaces:**
- `recomputeLeg(db, leg, routing): Promise<'ok' | 'failed'>`: depart = `from_stop.time` (or 09:00) + 60 min stay on that day's date in the city timezone; straight-line ≤ 1.2 km → `walk` with `duration_min = ceil(meters / 80)` and **no** routing call; otherwise `planRoute` → fastest option; result walks only and ≤ 15 min → `walk`. Writes `mode, duration_min, summary ("Circular Quay → St James, 4 min"), fare_min, fare_max, status, computed_at`, increments `attempts`; 3rd failure → `failed`.
- `recomputeStaleLegs(tripId)` (after-response) and cron sweep (all trips, `stale` and `computed_at` older than 2 min or null, limit 50) use the **service client** and the same function; the cron is guarded by `requireCron`.

- [ ] **Step 1: Write failing tests**: two stops 600 m apart → `walk`, routing not called; routing throws 3 times → `failed`, `attempts = 3`; cron without bearer → 401 and no write.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build; add a stop in the UI → leg shows "calculating…" then a mode + text after reload.
- [ ] **Step 5: Commit**: `git commit -m "feat(trip): background leg recompute with cron sweep"`

---

### Task 7: Share + export — §13

**Files:**
- Create: `src/lib/trip/{share,ics}.ts` (+ tests), `src/app/api/v1/me/trips/[id]/share/route.ts`, `src/app/api/v1/me/trips/[id]/export/route.ts`, `src/app/api/v1/shared/[token]/route.ts`, `src/app/[locale]/(site)/shared/[token]/page.tsx`, `src/components/trip/{share-dialog,export-menu}.tsx`, trip print CSS

**Interfaces:**
- `POST /me/trips/:id/share` → `{ url }` (reuses the trip's live token or creates one); `DELETE` same path → revokes (`revoked_at = now()`).
- `loadSharedTrip(token)` (service client): token exists and `revoked_at is null` and trip not deleted → `{ title, start_date, end_date, days: [{ day_no, date, title, off_map, stops: [{ time, place: { slug, name, type, cover } }], legs: [{ mode, duration_min, summary }] }] }`. **No** `user_id`, trip `id`, stop notes or saved items (Review Focus 4). Page is `noindex`, rate-limited 60/min/IP.
- `GET /me/trips/:id/export?format=ics` → `text/calendar` with one `VEVENT` per timed stop (DTSTART in the city TZID, 60 min, SUMMARY = place name, LOCATION = place name + area), CRLF line endings, lines folded at 75 octets, text escaped (`\,` `\;` `\n`). `format=pdf` is not an endpoint: Export → PDF calls `window.print()` (deviation 4).

- [ ] **Step 1: Write failing tests**: revoked token → 404; unknown token → 404; shared payload has no `user_id`/`id`/`note` keys (deep check); ICS: a name containing `,` and `;` is escaped, a 100-char summary is folded, `DTSTART;TZID=Australia/Sydney:20261102T090000`.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: tests/lint/build; open a share link in a private window (no login) → read-only view; revoke → 404; the `.ics` imports into Google Calendar with correct local times.
- [ ] **Step 5: Commit**: `git commit -m "feat(trip): read-only share links and ICS export"`

---

### Task 8: Admin CRUD for Phase 2 content + dev seed

**Files:**
- Create: `src/app/[locale]/admin/{transit,scenic,dishes,prepare}/…` (list + `[id]` edit + `actions.ts` + `schema.ts`, following `admin/places`):
  - `transit`: agencies (+ card link), lines + `line_stops` + `line_service_summary`, cards, `fare_rules` (Zod discriminated union for the two rule shapes, deviation 2), airport transfers
  - `scenic`: scenic routes
  - `dishes`: dishes + pairings + `dish_venues` (venue picker limited to published places of type restaurant/bar/cafe)
  - `prepare`: checklist templates, packing items, region months (12-row grid per region), connectivity options, content blocks `transport_tips` / `facts` / `health`
- Modify: `src/app/[locale]/admin/admin-nav.tsx`, `src/app/[locale]/admin/review/page.tsx` (closed venues still linked from `dish_venues`), `supabase/seed.sql` (dev sample rows for Sydney, Melbourne, Auckland: 2 agencies + fare rules each, 6 lines with summaries, 3 cards, 4 scenic routes, 9 dishes with 3 must-try, 14 checklist templates, packing items for 4 seasons, region months, 4 connectivity options, 3 airport transfers; prices `verified_at = null`), `messages/{th,en}.json` (`admin.*`)

**Interfaces:**
- Every `save<Entity>`: `requireRole(['editor','admin'])` → Zod (th + en) → upsert via the session client (RLS + audit) → `revalidateTag`: transit/scenic/cards/fares → `transport`; airport transfers → `transport`, `prepare`; dishes/pairings/dish_venues → `dishes`; prepare tables + `facts`/`health` → `prepare`; `transport_tips` → `transport`; dish collections (existing collections admin) also → `dishes`.
- Publishing a dish requires cover media with `credit` + `license` (same refine as places).

- [ ] **Step 1: Write failing tests**: per-entity `schema.test.ts` (missing `name_en` fails; `fare_rules` with unknown `kind` fails; distance bands must ascend); action tests: saving a dish calls `revalidateTag('dishes')`; saving an airport transfer revalidates `transport` and `prepare`.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement** + reseed dev (`supabase db reset --linked` only after checking `supabase/.temp/project-ref` is the dev ref).
- [ ] **Step 4: Verify**: tests/lint/build; as an editor publish a dish → it appears on `/dishes` without redeploy; edit a fare rule → the next uncached route plan shows the new fare.
- [ ] **Step 5: Commit**: `git commit -m "feat(admin): CRUD for transport, dishes, prepare content; dev seed"`

---

### Task 9: Final pass — nav, SEO, smoke

**Files:**
- Modify: `generateMetadata` on the new public pages (`/transport`, `/dishes`, `/dishes/[slug]`), `src/lib/seo/sitemap.ts` test
- Dishes get no JSON-LD (spec §15 SEO lists only TouristAttraction / Restaurant / BarOrPub); hreflang only.

**Interfaces:**
- Public pages get `alternates.languages` th/en via `pageMetadata`. `/prepare`, `/trip/*` and `/shared/*` are `noindex` and absent from sitemaps.

- [ ] **Step 1: Write failing test**: sitemap kinds include `dishes` and exclude `trip`/`shared`.
- [ ] **Step 2: Run `npm test` and expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify**: `npm test`, `npm run test:db`, `npm run lint`, `npm run build`; every header/tab-bar link on `/en` and `/th` returns 200 (signed in) or opens the login dialog (signed out, gated paths), with no 404s left.
- [ ] **Step 5: Commit**: `git commit -m "feat(seo): metadata and sitemap for Phase 2 pages"`

---

## Order and dependencies

Task 0 first. Then: Task 1 → Task 2 (needs routing). Task 3 and Task 4 are independent (`currentTripId` inserts `trips` directly, so it doesn't need Task 5). Task 5 → Task 6 (needs Tasks 1 + 5) → Task 7. Task 8 after Tasks 2–4 (forms follow their loaders). Task 9 last.
Tasks 2, 3 and 4 touch disjoint folders and can run in parallel once Task 1 lands, except that all three add keys to `messages/{th,en}.json` and tags to `cache.ts`, so merge those files carefully.

## Before production (Earth)

- Google Cloud: enable Routes API, restrict the key to it, set a daily request quota and a billing alert.
- Replace `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (currently a publishable key, per memory) before running crons or the shared-trip loader against any real project.
- Add `GOOGLE_ROUTES_API_KEY` and confirm `CRON_SECRET` in Vercel env.

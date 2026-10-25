# TravelAusNZ MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared platform every TravelAusNZ page sits on — project scaffold, full Supabase schema with RLS and audit, auth, th/en i18n, the design-system site shell (tokens, theme, header/footer/tab bar), API conventions, a role-guarded admin shell, and observability.

**Architecture:** Next.js 15 App Router app with locale-prefixed routes (`/th`, `/en`) talking to Supabase (Postgres/Auth/Storage). Schema lives in ordered SQL migrations tested with pgTAP; TypeScript helpers in `src/lib/*` own cross-cutting rules (i18n fallback, API errors, pagination, rate limit, role checks) so page plans only compose them.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, next-intl, @supabase/ssr + supabase-js, Supabase CLI linked to a hosted **dev** project (no Docker), pgTAP, Zod, @upstash/ratelimit + @upstash/redis, Vitest (+ jsdom, @testing-library/react for components), `next/font` (Prompt), @sentry/nextjs, posthog-js, @vercel/analytics.

**Spec:** `TravelAusNZ— Module & System Design.md` (project root). Sections 2 (shared modules) and 8 (schema) are implemented here.

**Out of scope (separate plans, in this order):** Home + Map (incl. `core-search` + `search_index` view), Currency (fx ingest/rollup), Dishes, Visa (link-check job), Prepare/trip (incl. `create_trip()`, `get_shared_trip()`, `/api/v1/me/saved`, guest-save localStorage merge), admin CRUD for places/dishes/visa + review queue.

## Global Constraints

- Next.js **15** App Router + TypeScript + Tailwind; pin `create-next-app@15`.
- Postgres 16 with extensions `postgis`, `pg_trgm`, `pgcrypto`.
- Locales exactly `th` and `en`; default `th`; URLs `/th/...`, `/en/...`; UI strings in `messages/th.json` and `messages/en.json` (next-intl).
- Translatable DB text is `jsonb` shaped `{"th": "...", "en": "..."}`, read via `t(row.x_i18n, locale)` with fallback to `en`.
- `profiles` defaults: `locale = 'th'`, `home_currency = 'THB'`, `role = 'user'`; roles `user | editor | admin`.
- Content status enum `draft | published | archived`; anon/authenticated read only `published`.
- REST under `/api/v1`, JSON, errors `{ error: { code, message } }`, Zod validation, cursor pagination `?cursor=&limit=`.
- Rate limit **60 req/min/IP** (Upstash), applied only to write endpoints and search.
- Service role key used server-side only (`import 'server-only'`).
- No Docker: development and pgTAP run against a dedicated hosted Supabase **dev** project (free tier, region `ap-southeast-2`), via `supabase link`. `db reset --linked` wipes that database — never link the production project.
- Timezones always via `at time zone <cities.timezone>`; never hardcode an offset.
- Analytics events limited to `search`, `place_view`, `save_item`, `fx_convert`, `visa_official_click`, `checklist_complete`; no PII.
- Schema DDL is copied verbatim from spec §8.1–8.7 except the deviations below.
- Earth's decision for later plans (not built here): FX provider sits behind an `FxProvider` interface defaulting to exchangerate.host; map tiles default to MapTiler via an env-configured style URL.

**Front-end (design source: `design/pages/*.dc.html` — reference only, never imported at runtime; `System.dc.html` = tokens, `Main.dc.html` = desktop header/footer, `HomeMobile.dc.html` = mobile header + bottom tab bar):**

- Light tokens, verbatim from `Main.dc.html` `.sc`: `--bg #F6F2EA`, `--surface #FBF9F4`, `--ink #13213A`, `--ink2 #4A5468`, `--ink3 #8A92A3`, `--line rgba(19,33,58,.14)`, `--line2 rgba(19,33,58,.07)`, `--copper #9E5229`, `--copper-tint rgba(158,82,41,.09)`, `--on-copper #FBF9F4`, `--ph1 #D6D8DD`, `--ph2 #C2C7D0`, `--ph3 #A7AEBB`, `--deep #13213A`, `--on-deep #F6F2EA`, `--shadow 0 1px 2px rgba(19,33,58,.04),0 14px 36px rgba(19,33,58,.07)`.
- Dark tokens, verbatim from `.sc.dark`: `--bg #0E1729`, `--surface #14203A`, `--ink #F3EEE4`, `--ink2 #B7BDC8`, `--ink3 #7D8698`, `--line rgba(243,238,228,.16)`, `--line2 rgba(243,238,228,.07)`, `--copper #D08A5E`, `--copper-tint rgba(208,138,94,.14)`, `--on-copper #0E1729`, `--ph1 #22304A`, `--ph2 #2A3953`, `--ph3 #344462`, `--deep #091121`, `--on-deep #F3EEE4`, `--shadow 0 1px 2px rgba(0,0,0,.2),0 14px 36px rgba(0,0,0,.28)`.
- One typeface: Prompt (Google Fonts via `next/font`), weights 300/400/500/600, subsets `latin` + `thai`; body weight 300, `-webkit-font-smoothing: antialiased`. Eyebrow label: 11px, weight 500, `letter-spacing: .22em`, uppercase.
- Radius: 4 tag · 6 button · 8–10 card; `999px` pills/icon buttons. Buttons: min-height 44px, padding `0 22px`, 14px weight 500. Icon button: 44×44 round, 1px `--line` border. Page gutter `clamp(16px, 4vw, 56px)`, content max-width 1440px.
- Icons: 1.4px stroke line icons, single colour (`currentColor`), no fills; copy SVG paths from the artboards.
- Motion: state changes 0.5–0.6s ease, nothing bounces; all transitions disabled under `prefers-reduced-motion: reduce`. Every interactive element gets a visible `:focus-visible` ring (2px `--copper`, 2px offset) — WCAG 2.2 AA from the spec.
- Theme (Earth's decision): default follows `prefers-color-scheme`; the header toggle switches light/dark and stores the choice in cookie `theme` (`light` | `dark`, 1 year, `path=/`, `SameSite=Lax`); the server renders the cookie's class on `<html>` so there is no flash.
- Primary nav (Earth's decision — spec pages only, design labels): Destinations `/` · Map `/map` · Eat & Drink `/dishes` · Money `/currency` · Visa & Entry `/visa` · Plan your trip `/prepare`, plus a ghost "My Trip" button → `/prepare`. Mobile bottom tab bar (from `HomeMobile`): Discover `/` · Map `/map` · Eat `/dishes` · Money `/currency` · Trip `/prepare`; Visa & Entry is reached via the mobile menu. Routes other than `/` and `/login` are built by later page plans and 404 until then.
- Footer (Earth's decision): no newsletter form. Contents: wordmark, the land acknowledgement from `Main.dc.html`, link columns Explore (Map, Eat & Drink) and Plan (Money, Visa & Entry, Plan your trip), bottom row `© 2026 TravelAusNZ` and "Prices in AUD / NZD, indicative". No links to pages that no plan builds (the design's "Company" column is dropped).
- Out of this plan: header search button and AU/NZ country segment (page-level, come with Home/search plans).
- All user-visible strings come from `messages/{th,en}.json`.

## Deviations from spec (security/consistency — confirm in review)

1. **`profiles` policy:** spec's `profile_self ... for all` lets a user `update profiles set role = 'admin'` on their own row. Replace with select + update policies and column-level grants so `role` is not user-writable.
2. **RLS on every `public` table:** spec only lists some tables; Supabase exposes every public table to `anon` via PostgREST, so a table without RLS is world-writable. Reference tables get public-read + editor-write; `fx_rates`, `link_checks`, `audit_log`, `content_feedback` get RLS with no policies (service role only, per spec §8.9); `fx_alerts` gets an owner policy.
3. **Audit/updated columns:** spec §2.7 says every content table has `updated_by`/`updated_at`, but §8 DDL does not. Follow the DDL; the touch trigger sets only columns that exist.
4. **Editor check** is a `security definer` function `is_editor()` reused by all edit policies instead of repeating the `exists (select ... from profiles ...)` subquery.

## Review Focus

1. A signed-in user updating their own `profiles.role` → must be rejected (permission denied). Test: Task 4.
2. A bar open Fri 18:00–02:00 checked Saturday 01:30 local, during AU daylight saving, and a Perth place at the same UTC instant → `is_open_now` uses each city's local time and the after-midnight rule. Test: Task 3.
3. Auth callback `?next=https://evil.com` or `//evil.com` → redirect stays on-site (falls back to `/`). Test: Task 7.
4. A tampered or garbage `cursor` / out-of-range `limit` → 400 `VALIDATION`, never 500. Test: Task 8.
5. `t()` given `null`, a missing `th` key, or an empty-string `th` → returns `en`, then `''`; never `undefined`. Test: Task 1.

---

### Task 1: Scaffold, test runner, core-content helpers

**Files:**
- Create: project via `create-next-app` (src dir, App Router, Tailwind, ESLint, `@/*` alias)
- Create: `vitest.config.ts`, `.env.example`, `.gitignore` additions (`.env*.local`)
- Create: `src/lib/i18n/t.ts`, `src/lib/media/path.ts`
- Test: `src/lib/i18n/t.test.ts`, `src/lib/media/path.test.ts`

**Interfaces:**
- Produces: `type Locale = 'th' | 'en'`; `const locales: readonly Locale[] = ['th','en']`; `const defaultLocale: Locale = 'th'`; `type I18nText = Partial<Record<Locale, string>>`; `t(value: I18nText | null | undefined, locale: Locale): string` — all from `src/lib/i18n/t.ts`.
- Produces: `mediaPath(entity: string, id: string, hash: string): string` → `"{entity}/{id}/{hash}.webp"` (bucket-relative key in bucket `media`).

- [ ] **Step 1: Scaffold and init git**

Run: `npx create-next-app@15 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` then `git init`, `npm i -D vitest @vitejs/plugin-react vite-tsconfig-paths`, add `"test": "vitest run"` to `package.json`.
`.env.example` lists: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SITE_URL`.

- [ ] **Step 2: Write failing tests**

```ts
// src/lib/i18n/t.test.ts
it('returns requested locale', () => expect(t({ th: 'ซิดนีย์', en: 'Sydney' }, 'th')).toBe('ซิดนีย์'))
it('falls back to en when th missing', () => expect(t({ en: 'Sydney' }, 'th')).toBe('Sydney'))
it('falls back to en when th is empty string', () => expect(t({ th: '', en: 'Sydney' }, 'th')).toBe('Sydney'))
it('returns empty string for null/undefined', () => { expect(t(null, 'th')).toBe(''); expect(t(undefined, 'en')).toBe('') })
it('returns empty string when no usable value', () => expect(t({}, 'en')).toBe(''))

// src/lib/media/path.test.ts
it('builds bucket key', () => expect(mediaPath('places', 'abc', 'f00')).toBe('places/abc/f00.webp'))
```

- [ ] **Step 3: Run `npm test` — expect FAIL (modules not found)**

- [ ] **Step 4: Implement `t()` and `mediaPath()`** per the Interfaces block.

- [ ] **Step 5: Run `npm test` — expect PASS; `npm run build` — expect success**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with i18n text and media path helpers"
```

---

### Task 2: Linked Supabase dev project + core schema + profile trigger + seed

**Files:**
- Create: `supabase/` via `npx supabase init`
- Create: `supabase/migrations/20261024000001_core.sql`
- Create: `supabase/seed.sql`
- Test: `supabase/tests/core.test.sql`

**Interfaces:**
- Produces: tables/enums from spec §8.1 verbatim (`content_status`, `country_code`, `place_type`, `transit_mode`, `user_role`, `saved_entity`, `profiles`, `regions`, `cities`, `tags`, `media_assets`, `audit_log`).
- Produces: `public.handle_new_user()` (`security definer`, `set search_path = ''`) + trigger `on_auth_user_created after insert on auth.users`, inserting `profiles(id, display_name)` with `display_name = new.raw_user_meta_data->>'full_name'`.
- Produces seed rows: regions `nsw`(AU), `vic`(AU), `auckland`(NZ); cities `sydney` (`Australia/Sydney`, point 151.2093 -33.8688), `melbourne` (`Australia/Melbourne`, 144.9631 -37.8136), `auckland` (`Pacific/Auckland`, 174.7633 -36.8485), all `published`. (`currencies` seed lives in Task 3 since the table is created there.)

- [ ] **Step 1: Init and link the dev project**

Prerequisite (Earth): a Supabase project named `travelausnz-dev` in `ap-southeast-2`.
Run: `npx supabase init`, `npx supabase login`, `npx supabase link --project-ref <dev-ref>`. Copy Project URL, anon key and service_role key from Dashboard → Project Settings → API into `.env.local`.

- [ ] **Step 2: Write failing pgTAP test `supabase/tests/core.test.sql`**

Inside `begin; create extension if not exists pgtap; select plan(6); ... select * from finish(); rollback;`:
- `has_extension('postgis')`, `has_extension('pg_trgm')`, `has_table('public','profiles')`
- insert `auth.users(id, email, raw_user_meta_data)` with `'{"full_name":"Earth"}'` → `results_eq` on `select locale, home_currency, role::text, display_name from profiles where id = <id>` = `('th','THB','user','Earth')`
- `results_eq('select count(*)::int from cities where status = ''published''', array[3])`

- [ ] **Step 3: Run `npx supabase test db --linked` — expect FAIL**

- [ ] **Step 4: Write migration (spec §8.1 DDL + trigger) and `seed.sql`**

- [ ] **Step 5: Run `npx supabase db reset --linked && npx supabase test db --linked` — expect PASS**

- [ ] **Step 6: Commit** — `git commit -m "feat(db): core schema, profile trigger, city seed"`

---

### Task 3: Content and user-data schema + `is_open_now`

**Files:**
- Create: `supabase/migrations/20261024000002_places.sql` (spec §8.2 incl. `is_open_now`)
- Create: `supabase/migrations/20261024000003_transit_fx_dishes_visa.sql` (spec §8.3–8.6)
- Create: `supabase/migrations/20261024000004_trip.sql` (spec §8.7)
- Modify: `supabase/seed.sql` (currencies)
- Test: `supabase/tests/schema.test.sql`, `supabase/tests/is_open_now.test.sql`

**Interfaces:**
- Consumes: Task 2 tables/enums.
- Produces: every table in spec §8.2–8.7 verbatim; `is_open_now(p_place uuid, p_at timestamptz) returns boolean`.
- Produces seed: `currencies` `THB`(฿), `AUD`(A$), `NZD`(NZ$), `USD`($) with `name_i18n` th/en.

- [ ] **Step 1: Write failing tests**

`schema.test.sql`: `has_table` for each of the 30 tables in §8.2–8.7; `throws_ok` inserting a `trips` row with `end_date < start_date` (SQLSTATE `23514`); `throws_ok` inserting `places.price_level = 5` (`23514`).

`is_open_now.test.sql` (create own city/places inside the transaction):
```sql
-- Sydney bar, Fri(5) 18:00–02:00
select is(is_open_now(:bar, '2026-10-16 14:30Z'), true,  'Sat 01:30 AEDT open (after midnight)');
select is(is_open_now(:bar, '2026-10-16 15:30Z'), false, 'Sat 02:30 AEDT closed');
select is(is_open_now(:bar, '2026-10-16 06:30Z'), false, 'Fri 17:30 AEDT not yet open');
-- Perth cafe (Australia/Perth), Sat(6) 08:00–15:00
select is(is_open_now(:cafe, '2026-10-16 23:30Z'), false, 'Sat 07:30 AWST closed');
select is(is_open_now(:cafe, '2026-10-17 00:30Z'), true,  'Sat 08:30 AWST open');
-- Auckland cafe, Sat(6) 08:00–15:00, NZDT
select is(is_open_now(:akl, '2026-10-16 21:00Z'), true,  'Sat 10:00 NZDT open');
```

- [ ] **Step 2: Run `npx supabase test db --linked` — expect FAIL**

- [ ] **Step 3: Write the three migrations and currency seed**

- [ ] **Step 4: Run `npx supabase db reset --linked && npx supabase test db --linked` — expect PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(db): places, transit, fx, dishes, visa, trip schema"`

---

### Task 4: RLS, role protection, audit, media bucket

**Files:**
- Create: `supabase/migrations/20261024000005_rls_audit.sql`
- Create: `supabase/migrations/20261024000006_media_bucket.sql`
- Test: `supabase/tests/rls.test.sql`, `supabase/tests/audit.test.sql`

**Interfaces:**
- Consumes: all tables from Tasks 2–3.
- Produces: `public.is_editor() returns boolean` (`stable security definer set search_path = ''`; true when caller's `profiles.role in ('editor','admin')`).
- Produces policies:
  - status tables (`cities`, `places`, `collections`, `dishes`, `visa_guide_sections`): `<t>_read for select using (status = 'published')`, `<t>_edit for all using (is_editor()) with check (is_editor())`.
  - reference tables (`regions`, `tags`, `media_assets`, `place_hours`, `place_tags`, `collection_items`, `transit_agencies`, `transit_routes`, `transit_stops`, `route_stops`, `transit_cards`, `city_climate`, `currencies`, `fx_rates_daily`, `cost_reference_items`, `dish_categories`, `dish_venues`, `official_links`, `section_links`, `checklist_templates`): public `select using (true)` + `is_editor()` write.
  - owner tables: `trips`, `saved_items`, `fx_alerts` via `user_id = auth.uid()`; `trip_cities`, `trip_checklist_items`, `trip_budget_items` via parent trip ownership (spec §8.9 shape).
  - `profiles`: `profile_select_self for select using (id = auth.uid())`, `profile_update_self for update using (id = auth.uid()) with check (id = auth.uid())`; `revoke update on profiles from authenticated; grant update (display_name, locale, home_currency) on profiles to authenticated;`
  - no policies (service role only): `fx_rates`, `link_checks`, `audit_log`, `content_feedback`.
- Produces triggers on the five status tables: `touch_updated()` BEFORE UPDATE (sets `updated_at = now()` where column exists, `updated_by = auth.uid()` on `places`/`dishes`) and `audit_content()` AFTER INSERT/UPDATE/DELETE (`security definer`) writing `audit_log(table_name = TG_TABLE_NAME, row_id = coalesce(new.id, old.id)::text, action = TG_OP, diff = to_jsonb(coalesce(new, old)), actor = auth.uid())`.
- Produces storage bucket `media` (`public = true`); `storage.objects` insert/update/delete policies `bucket_id = 'media' and is_editor()`.

- [ ] **Step 1: Write failing tests**

Impersonate with `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` (and `set local role anon` for guests).

`rls.test.sql`:
- `is_empty($$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$, 'every public table has RLS')`
- anon sees a `published` place, not a `draft` one (`results_eq` on count)
- anon `insert into regions` → `throws_ok` `42501`
- user A `update profiles set role = 'admin' where id = A` → `throws_ok` `42501`
- user A `update profiles set locale = 'en'` → `lives_ok`
- user A cannot see user B's `trips` row (`is_empty`); A cannot insert a `trips` row with `user_id = B` (`throws_ok` `42501`)
- editor can `insert into places` (`lives_ok`); plain user cannot (`throws_ok` `42501`)
- anon `select from fx_rates` returns zero rows

`audit.test.sql`: as editor, update a place's `name_i18n` → one `audit_log` row with `table_name = 'places'`, `action = 'UPDATE'`, `actor = <editor id>`; place's `updated_by = <editor id>`.

- [ ] **Step 2: Run `npx supabase test db --linked` — expect FAIL**

- [ ] **Step 3: Write both migrations**

- [ ] **Step 4: Run `npx supabase db reset --linked && npx supabase test db --linked` — expect PASS (all suites)**

- [ ] **Step 5: Commit** — `git commit -m "feat(db): RLS on all tables, role protection, audit log, media bucket"`

---

### Task 5: Supabase clients, generated types, i18n routing, middleware

**Files:**
- Create: `src/lib/supabase/database.types.ts` (generated), `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/service.ts`, `src/lib/supabase/middleware.ts`
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `messages/th.json`, `messages/en.json`
- Create: `src/middleware.ts`
- Move: `src/app/layout.tsx`, `src/app/page.tsx` → `src/app/[locale]/layout.tsx`, `src/app/[locale]/(site)/page.tsx` (placeholder home showing `t('common.siteName')`; the `(site)` route group gets its layout in Task 6)
- Modify: `next.config.ts` (next-intl plugin), `package.json` (`"db:types"` script)
- Test: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: `locales`, `defaultLocale` from Task 1.
- Produces: `createClient(): Promise<SupabaseClient<Database>>` in `server.ts` (cookie-bound, for RSC/route handlers/server actions); `createClient(): SupabaseClient<Database>` in `browser.ts`; `createServiceClient(): SupabaseClient<Database>` in `service.ts` (starts with `import 'server-only'`, uses `SUPABASE_SERVICE_ROLE_KEY`).
- Produces: `updateSession(request: NextRequest, response: NextResponse): Promise<NextResponse>` — refreshes the auth cookie onto the given response.
- Produces: `routing = defineRouting({ locales, defaultLocale, localePrefix: 'always' })`; `src/middleware.ts` runs next-intl middleware, then `updateSession` on its response; matcher excludes `api`, `auth`, `_next`, files with extensions.
- Produces message keys used later: `common.siteName`, `nav.*`/`footer.*`/`theme.*` (Task 6), `auth.*` (Task 7), `admin.*` (Task 9).

- [ ] **Step 1: Write failing test** — `messages.test.ts`: flattened key set of `messages/th.json` equals that of `messages/en.json`; both contain `common.siteName`.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Install and implement**

`npm i next-intl @supabase/ssr @supabase/supabase-js server-only`; `"db:types": "supabase gen types typescript --linked > src/lib/supabase/database.types.ts"`, run it; implement files per Interfaces; `<html lang={locale}>` in the locale layout; `generateStaticParams` returns both locales.

- [ ] **Step 4: Verify**

Run: `npm test` → PASS. `npm run dev`, then `curl -sI http://localhost:3000/` → `307` with `location: /th`; `curl -s http://localhost:3000/en` contains the en site name; `npm run build` succeeds.

- [ ] **Step 5: Commit** — `git commit -m "feat: supabase clients, th/en routing, session middleware"`

---

### Task 6: Design tokens, theme, UI primitives, site shell

**Files:**
- Modify: `src/app/globals.css` (tokens + Tailwind v4 `@theme inline` mapping + base styles), `src/app/[locale]/layout.tsx` (Prompt font, `<html>` theme class from cookie), messages files (`nav.*`, `footer.*`, `theme.*`, `menu.*`, `locale.*`)
- Create: `src/lib/theme.ts`, `src/i18n/navigation.ts`
- Create: `src/components/ui/button.tsx`, `src/components/ui/text-field.tsx`
- Create: `src/components/site/nav-items.ts`, `src/components/site/logo.tsx`, `src/components/site/site-header.tsx`, `src/components/site/mobile-menu.tsx` (client), `src/components/site/mobile-tab-bar.tsx` (client), `src/components/site/site-footer.tsx`, `src/components/site/theme-toggle.tsx` (client), `src/components/site/locale-switch.tsx`
- Create: `src/app/[locale]/(site)/layout.tsx` (header + main + footer + tab bar)
- Test: `src/lib/theme.test.ts`, `src/components/site/nav-items.test.ts`, `src/components/ui/text-field.test.tsx`

**Interfaces:**
- Consumes: `routing` (Task 5), `Locale` (Task 1), token values in Global Constraints.
- Produces CSS: light tokens on `:root`; dark tokens on `:root.dark` and inside `@media (prefers-color-scheme: dark) { :root:not(.light) { … } }`. Tailwind colour utilities named after the tokens (`bg-bg`, `bg-surface`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `border-line-2`, `bg-copper`, `bg-copper-tint`, `text-on-copper`, `bg-deep`, `text-on-deep`, `bg-ph-1..3`), `shadow-soft`, `font-sans` = Prompt; `@utility eyebrow`; global `:focus-visible` ring and reduced-motion rule.
- Produces: `THEME_COOKIE = 'theme'`; `type ThemePref = 'light' | 'dark' | 'system'`; `parseThemeCookie(value: string | undefined): ThemePref`; `themeClass(pref: ThemePref): '' | 'light' | 'dark'` — in `src/lib/theme.ts`.
- Produces: `{ Link, usePathname, redirect, getPathname } = createNavigation(routing)` in `src/i18n/navigation.ts` (locale-aware; later tasks import `Link`/`redirect` from here).
- Produces: `type NavKey = 'destinations' | 'map' | 'dishes' | 'currency' | 'visa' | 'prepare'`; `navItems: { key: NavKey; href: string }[]` in the Global Constraints order; `type TabKey = 'discover' | 'map' | 'eat' | 'money' | 'trip'`; `tabItems: { key: TabKey; href: string }[]` — the five mobile tabs in Global Constraints order (labels from `nav.tab.*`); `isActive(pathname: string, href: string): boolean` where `pathname` is locale-stripped (`/` active only for exactly `/`; `/map` active for `/map` and `/map/...`, not `/mapx`).
- Produces: `Button` (`variant: 'primary' | 'ghost'`, renders `<button>`) and `buttonClass(variant): string` for styling a `Link`; `IconButton` (`label: string` → `aria-label`); `TextField({ label, name, type?, defaultValue?, error?, required? })` — eyebrow `<label htmlFor>`, input 15px weight 400, `aria-invalid` + `aria-describedby` pointing at the error text when `error` is set.
- Site header (≥ `lg`): logo + wordmark → `/`, `navItems` links (`aria-current="page"` when `isActive`), `LocaleSwitch` (TH | EN, keeps current path), `ThemeToggle`, ghost "My Trip" → `/prepare`; sticky, `--bg` background, `--line2` bottom border, as `Main.dc.html`. Below `lg`: logo + menu `IconButton` opening `MobileMenu` — a native `<dialog>` (focus moves in, Esc closes, focus returns) listing all `navItems` plus locale switch and theme toggle. `MobileTabBar` (below `lg` only): sticky bottom, 5 tabs with the `HomeMobile` icons, active tab `aria-current`.
- `ThemeToggle`: reads the resolved theme (`html` class, else `matchMedia('(prefers-color-scheme: dark)')`), flips it, writes the cookie per Global Constraints, sets `html` class; `aria-label` from `theme.toggle`, icon from `Main.dc.html`.
- Root layout: `cookies()` → `themeClass(parseThemeCookie(...))` on `<html className>`; `lang={locale}`; Prompt `className` on `<body>` with `bg-bg text-ink`.

- [ ] **Step 1: Write failing tests**

```ts
// theme.test.ts
it.each([['dark','dark'],['light','light'],[undefined,'system'],['blue','system']])('parseThemeCookie(%s)', (v, out) => expect(parseThemeCookie(v)).toBe(out))
it('themeClass', () => { expect(themeClass('system')).toBe(''); expect(themeClass('dark')).toBe('dark') })

// nav-items.test.ts
it('nav hrefs', () => expect(navItems.map(i => i.href)).toEqual(['/', '/map', '/dishes', '/currency', '/visa', '/prepare']))
it('tab hrefs', () => expect(tabItems.map(i => i.href)).toEqual(['/', '/map', '/dishes', '/currency', '/prepare']))
it.each([['/', '/', true], ['/map', '/', false], ['/map', '/map', true], ['/map/sydney', '/map', true], ['/mapx', '/map', false]])
  ('isActive(%s, %s)', (p, h, out) => expect(isActive(p, h)).toBe(out))
```
`text-field.test.tsx` (`// @vitest-environment jsdom`, @testing-library/react): label click focuses the input (`getByLabelText`); with `error="Required"` the input has `aria-invalid="true"` and `aria-describedby` resolving to the element containing "Required"; without `error`, neither attribute is present.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Implement** — `npm i -D jsdom @testing-library/react @testing-library/jest-dom`; then tokens/CSS, `theme.ts`, `navigation.ts`, primitives, shell components, `(site)/layout.tsx`, messages (th + en, identical key sets) per Interfaces.

- [ ] **Step 4: Verify**

`npm test` → PASS (messages key-parity test included); `npm run build` succeeds. With `npm run dev`, compare against the artboards:
- `/th` at 1440px vs `Main.dc.html` header and footer (tokens, Prompt, spacing, hairlines); toggle theme → dark tokens match `.sc.dark`; reload → theme persists with no flash; clear the cookie with OS dark mode on → dark.
- `/th` at 390px vs `HomeMobile.dc.html` header and tab bar; menu opens, Esc closes, focus returns to the menu button.
- Tab through header: every control shows the copper focus ring; `/en` shows English labels and the locale switch keeps the path.

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): design tokens, theme toggle, site header/footer/tab bar"`

---

### Task 7: Auth — login, callback, current profile, role guard

**Files:**
- Create: `src/app/[locale]/(site)/login/page.tsx`, `src/app/[locale]/(site)/login/login-form.tsx` (client)
- Create: `src/app/auth/callback/route.ts`, `src/app/auth/sign-out/route.ts`
- Create: `src/lib/auth/safe-next.ts`, `src/lib/auth/profile.ts`
- Configure (dev project Dashboard, not `config.toml` — that only drives a local stack): Authentication → Providers: enable Email (magic link), Google, Apple with their client id/secret; Authentication → URL Configuration: Site URL `http://localhost:3000`, redirect URLs `http://localhost:3000/auth/callback`
- Modify: messages files (`auth.*`)
- Test: `src/lib/auth/safe-next.test.ts`, `src/lib/auth/profile.test.ts`

**Interfaces:**
- Consumes: `createClient()` (server/browser) from Task 5; `Database` types; `Button`, `buttonClass`, `TextField`, `redirect` from `@/i18n/navigation` (Task 6). The login page renders inside the `(site)` shell.
- Login UI (no artboard exists — compose from tokens): centred card, max-width 420px, `bg-surface`, radius 10, `shadow-soft`, padding 40px (24px below `sm`); copper eyebrow `auth.eyebrow`, H2 heading (36px, weight 600) `auth.title`, body-L lede in `--ink2`; `TextField` email (required, `type="email"`); full-width primary `Button` `auth.sendLink`; hairline divider with `auth.or`; two full-width ghost buttons "Continue with Google" / "Continue with Apple" (text only, no brand logos). After sending: the form is replaced by `auth.checkEmail` text in an `aria-live="polite"` region; `?error=auth` shows `auth.error` above the form in copper; a send failure shows its message via `TextField` `error`. Submit button is disabled while pending.
- Produces: `safeNextPath(next: string | null): string` — returns `next` only if it starts with a single `/` and not `//` or `/\`; otherwise `'/'`.
- Produces: `type Profile = Database['public']['Tables']['profiles']['Row']`; `getCurrentProfile(): Promise<Profile | null>`; `requireRole(roles: Profile['role'][]): Promise<Profile>` — no session → `redirect('/{locale}/login?next=...')`; role not allowed → `notFound()`.
- Login form: email → `signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback?next=${next}` } })`; buttons → `signInWithOAuth({ provider: 'google' | 'apple', options: { redirectTo } })`.
- Callback: `exchangeCodeForSession(code)` → redirect to `safeNextPath(next)`; missing/failed code → redirect `/{defaultLocale}/login?error=auth`.
- Sign-out: POST → `signOut()` → redirect `/`.

- [ ] **Step 1: Write failing tests**

```ts
// safe-next.test.ts
it.each([
  ['/th/admin', '/th/admin'],
  [null, '/'],
  ['https://evil.com', '/'],
  ['//evil.com', '/'],
  ['/\\evil.com', '/'],
  ['admin', '/'],
])('safeNextPath(%s) -> %s', (input, out) => expect(safeNextPath(input)).toBe(out))
```
`profile.test.ts` (mock `@/lib/supabase/server` and `next/navigation`): no user → `requireRole(['admin'])` calls `redirect`; user with role `user` → calls `notFound`; role `editor` with `['editor','admin']` → resolves to the profile.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Implement** per Interfaces.

- [ ] **Step 4: Verify**

`npm test` → PASS. With `npm run dev`: `/th/login` at 1440px and 390px, light and dark, matches the Login UI description (tokens, Prompt, focus rings); submit a real email on `/th/login` (built-in SMTP sends only a few emails per hour — don't loop), open the link from that inbox, land on `/` signed in; `profiles` row exists with `locale = 'th'`.

- [ ] **Step 5: Commit** — `git commit -m "feat(auth): magic link + OAuth login, safe callback, role guard"`

---

### Task 8: API conventions — errors, validation, pagination, rate limit

**Files:**
- Create: `src/lib/api/errors.ts`, `src/lib/api/validate.ts`, `src/lib/api/cursor.ts`, `src/lib/api/rate-limit.ts`
- Test: `src/lib/api/errors.test.ts`, `src/lib/api/validate.test.ts`, `src/lib/api/cursor.test.ts`, `src/lib/api/rate-limit.test.ts`

**Interfaces:**
- Produces: `type ApiErrorCode = 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL'`; `apiError(code: ApiErrorCode, message: string, status: number): NextResponse` → body `{ error: { code, message } }`.
- Produces: `parseQuery<T>(schema: z.ZodType<T>, params: URLSearchParams): { ok: true; data: T } | { ok: false; response: NextResponse }` and `parseBody<T>(schema, req: Request): Promise<same union>` — failures (incl. invalid JSON) → `apiError('VALIDATION', <first issue message>, 400)`.
- Produces: `type Cursor = { sort: string | number; id: string }`; `encodeCursor(c: Cursor): string` (base64url JSON); `decodeCursor(s: string): Cursor | null`; `paginationSchema = z.object({ cursor: <optional string transformed by decodeCursor; null result adds issue "invalid cursor">, limit: z.coerce.number().int().min(1).max(100).default(20) })` — parsed `cursor` type is `Cursor | undefined`.
- Produces: `clientIp(req: Request): string` — first entry of `x-forwarded-for`, else `x-real-ip`, else `'unknown'`; `rateLimit(req: Request, opts?: { limit?: number; window?: Duration; prefix?: string }): Promise<NextResponse | null>` — defaults 60 per `'1 m'` sliding window; returns `apiError('RATE_LIMITED', ..., 429)` with `Retry-After` header when exceeded, else `null`.

- [ ] **Step 1: Write failing tests**

- `errors`: `await apiError('NOT_FOUND','x',404).json()` equals `{ error: { code: 'NOT_FOUND', message: 'x' } }`, status 404.
- `cursor`: round-trip `{ sort: 5, id: 'a' }`; `decodeCursor('%%%')` and `decodeCursor(btoa('{"x":1}'))` → `null`.
- `validate`: `parseQuery(paginationSchema, new URLSearchParams('cursor=garbage'))` → `ok: false`, status 400, code `VALIDATION`; `limit=0` and `limit=101` → 400; empty params → `{ limit: 20 }`; `parseBody` with body `'not json'` → 400 `VALIDATION`.
- `rate-limit` (mock `@upstash/ratelimit` `limit()`): `{ success: false, reset }` → 429 with `Retry-After`; success → `null`; `clientIp` with `x-forwarded-for: '1.2.3.4, 10.0.0.1'` → `'1.2.3.4'`, no headers → `'unknown'`.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Implement** — `npm i zod @upstash/ratelimit @upstash/redis`; Redis via `Redis.fromEnv()`.

- [ ] **Step 4: Run `npm test` — expect PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(api): error shape, zod validation, cursor pagination, rate limit"`

---

### Task 9: Admin shell — guard, cities CRUD with publish revalidation, audit log viewer

**Files:**
- Create: `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/admin/page.tsx` (admin sits outside the `(site)` group: no public header/footer/tab bar)
- Create: `src/app/[locale]/admin/cities/page.tsx`, `src/app/[locale]/admin/cities/[id]/page.tsx`, `src/app/[locale]/admin/cities/actions.ts`, `src/app/[locale]/admin/cities/schema.ts`
- Create: `src/app/[locale]/admin/audit/page.tsx`
- Modify: messages files (`admin.*`)
- Test: `src/app/[locale]/admin/cities/schema.test.ts`

**Interfaces:**
- Consumes: `requireRole` (Task 7), server `createClient` (Task 5) — writes go through the user's session so RLS + audit triggers record the editor; `createServiceClient` only for reading `audit_log` (no policies on it); `t`, `Locale` (Task 1); `Button`, `buttonClass`, `TextField`, `IconButton`, `Logo`, `ThemeToggle`, `Link` (Task 6); `encodeCursor`/`decodeCursor` (Task 8).
- Admin UI (no artboard — utilitarian, same tokens): top bar on `bg-surface` with `--line2` bottom border: `Logo` + eyebrow "Admin", nav links Cities / Audit log (`aria-current`), `ThemeToggle`, sign-out ghost button (POST form to `/auth/sign-out`). Content max-width 1120px with the site gutter. Lists are `<table>`s with eyebrow `<th>` (scope="col"), 1px `--line2` row rules, 14px body, status shown as a `.tag`-style pill (published uses copper text + `--copper-tint`). City form: `TextField`s in a 2-column grid (1 column below `md`), status `<select>` styled like `TextField`, primary "Save" and ghost "Cancel"; field-level errors from `citySchema` go to each `TextField` `error`; a save error shows in an `aria-live` region.
- Produces: `citySchema = z.object({ region_id: z.coerce.number().int(), slug: z.string().regex(/^[a-z0-9-]+$/), name_th: z.string().min(1), name_en: z.string().min(1), timezone: z.string().refine(isIanaZone), lng: z.coerce.number().min(-180).max(180), lat: z.coerce.number().min(-90).max(90), status: z.enum(['draft','published','archived']) })`; `isIanaZone(tz: string): boolean` via `Intl.supportedValuesOf('timeZone')`.
- Produces server action `saveCity(id: number | null, formData: FormData): Promise<{ error?: string }>` — `requireRole(['editor','admin'])`, parse, upsert with `name_i18n = { th, en }` and `center = 'SRID=4326;POINT(lng lat)'`, then `revalidateTag('home')`.
- Layout calls `requireRole(['editor','admin'])`; nav: Cities, Audit log. Audit page: latest 100 rows (`table_name`, `row_id`, `action`, actor, `at`), cursor-paginated via `encodeCursor`/`decodeCursor` on `(at, id)`.

- [ ] **Step 1: Write failing test** — `schema.test.ts`: valid Sydney input parses; `slug: 'Sydney City'` fails; `timezone: 'UTC+10'` fails; `lat: 91` fails; `name_th: ''` fails.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Implement** pages and action per Interfaces.

- [ ] **Step 4: Verify**

`npm test` → PASS. Manually (1440px and 390px, light and dark): signed-in `user` visiting `/th/admin` → 404; promote via SQL (`update profiles set role='editor' ...` in Studio), edit Sydney's `name_th` → saved, and `/th/admin/audit` shows an `UPDATE` row on `cities` with your id.

- [ ] **Step 5: Commit** — `git commit -m "feat(admin): role-guarded shell, cities CRUD, audit log viewer"`

---

### Task 10: Observability and analytics

**Files:**
- Create: `src/instrumentation.ts`, `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Create: `src/lib/analytics/track.ts`, `src/components/analytics-provider.tsx` (client)
- Modify: `next.config.ts` (`withSentryConfig`), `src/app/[locale]/layout.tsx` (`<AnalyticsProvider>`, `<Analytics />` from `@vercel/analytics/next`)
- Test: `src/lib/analytics/track.test.ts`

**Interfaces:**
- Produces: `type AnalyticsEvent = 'search' | 'place_view' | 'save_item' | 'fx_convert' | 'visa_official_click' | 'checklist_complete'`; `track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void` — drops any prop whose key matches `/email|name|phone|passport|nationality|birth|ip/i` and any string value containing `@`, then `posthog.capture`. No-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset.
- PostHog init: `person_profiles: 'identified_only'`, `capture_pageview: 'history_change'`; never call `identify` with email.

- [ ] **Step 1: Write failing test** (mock `posthog-js`): `track('search', { q: 'flat white', email: 'a@b.c' })` → capture called with `{ q: 'flat white' }`; `track('place_view', { slug: 'x', note: 'me@x.com' })` → `{ slug: 'x' }`; with key unset → capture not called.

- [ ] **Step 2: Run `npm test` — expect FAIL**

- [ ] **Step 3: Implement** — `npm i @sentry/nextjs posthog-js @vercel/analytics`; Sentry `tracesSampleRate: 0.1`, `sendDefaultPii: false`.

- [ ] **Step 4: Verify** — `npm test` → PASS; `npm run build` succeeds; `npm run test:db` still PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: sentry, posthog, vercel analytics with PII-safe track()"`

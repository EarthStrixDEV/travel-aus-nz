# TravelAusNZ — Gap Report (spec Oct 24 + Design vs code)

2026-10-25 · compares `TravelAusNZ— Module & System Design.md` (rewritten version) and `design/pages/*.dc.html` against `main` at `3188fe7`.

## 1. What is built

Foundation plan Tasks 1–11 only: scaffold, i18n th/en, theme, site shell (header/footer/tab bar), auth (magic link/OAuth callback, login dialog, account menu), API helpers (errors, Zod, cursor, rate limit), admin shell with cities CRUD + audit log, Sentry/PostHog. Home `/` is a placeholder heading. **None of the 10 pages in spec §2 exist yet.**

## 2. Gaps against the spec

| Area | Spec | Code today | Gap |
| --- | --- | --- | --- |
| Schema | 59 tables §14.1–14.8, RLS §14.9 | 37 tables from the old spec | 30+ new tables (`hero_slides`, `journeys`, `journey_legs`, `venues`, `cuisines`, `venue_drinks`, `gallery_photos`, `place_stop_links`, `place_nearby_venues`, `neighbourhoods`, `content_blocks`, `faqs`, `fx_snapshots`, `fx_daily`, `budget_presets`, `permission_types`, `entry_rules`, `entry_documents`, `transit_lines`, `line_stops`, `line_service_summary`, `fare_rules`, `scenic_routes`, `airport_transfers`, `packing_items`, `region_months`, `connectivity_options`, `trip_days`, `trip_stops`, `trip_legs`, `trip_packing_items`, `trip_shares`, `newsletter_subscribers`); old tables to drop (`fx_rates`, `fx_rates_daily`, `fx_alerts`, `dish_categories`, `visa_guide_sections`, `section_links`, `transit_routes`, `route_stops`, `city_climate`, `trip_cities`, `trip_budget_items`); changed enums (`place_type`, `transit_mode` + `walk`, `saved_entity`), changed columns on `places`, `regions`, `cities`, `dishes`, `collections`, `collection_items`, `checklist_templates`, `trip_checklist_items`, `cost_reference_items` |
| Page map / nav | `/ /map /transport /eat-drink /gallery /dishes /money /visa /prepare /trip/[id]` | `/dishes` labelled Eat & Drink, `/currency`, no Transport/Gallery | Nav, tab bar, footer, messages, `GATED_PREFIXES` |
| Destinations §4 | 7 sections + 4 APIs | placeholder | all |
| Map §5 | MapLibre, clusters, drawer, 3 APIs | — | all, plus `maplibre-gl` dependency and tile style env |
| Gallery §6 | filters, masonry, lightbox, API, media rules (3 sizes + placeholder) | — | all |
| Transport §7 | OTP 2 routing, fares, explorer, scenic, cards, 4 APIs | — | all + OTP VM (open question: OTP vs Google Routes) |
| Eat & Drink §8 | tabs, 6 filters, drawer, 2 APIs | — | all |
| Signature Dishes §9 | filters, must-try, collections, detail, 2 APIs | — | all |
| Money §10 | converter, cross rate, trend, cost table, budget, states, 3 APIs | — | all + `FxProvider` |
| Visa §11 | client helper, permission types, timeline, docs, FAQ, 2 APIs | — | all |
| Prepare §12 | checklist, seasons, packing, facts, connectivity, transfers, 5 APIs | — | all |
| My Trip §13 | days, stops, legs, saved, share, export, 9 APIs | — | all |
| Jobs §15 | 9 jobs | none | all (`fx-ingest`, `fx-daily`, `gtfs-sync`, `line-summary`, `stop-links`, `leg-recompute`, `link-check`, `content-stale`, `newsletter-send`) |
| Admin | CRUD for all content + review queue | cities + audit only | every other entity |
| NFR | sitemap per kind, hreflang, JSON-LD, map list view, LCP targets | — | all |

## 3. Spec ↔ earlier decisions (resolved 2026-10-25)

- **Guest-first localStorage save + `/me/merge` (spec §3, §12, §13)** → not built; Task 11 login-gating stands. Consequence: no guest "My Trip · N" counter, Prepare checklist needs login.
- **Routes** → follow spec §2.

Still open:
- Spec §2 makes `/prepare` public (sync needs login); Task 11 gates the whole route. Plan keeps it gated until the Prepare plan.
- Design footer has the Dispatch newsletter and a "Company" column; Earth dropped both earlier. Spec §4 puts Dispatch on Home (Phase 2). Plan keeps the footer as decided.

## 4. Design ↔ spec mismatches (need Earth's call)

Grouped by phase. Plan default = follow the spec; ticked items are already folded into the Phase 1 plan because they are UI-only.

**Shell**
- Header link set differs per artboard. Union used: Destinations · Map · Transport · Eat & Drink · Gallery · Money · Visa & Entry · Plan your trip, plus AU/NZ segment + Search icon on Home only. Mobile tab bar in design: Discover · Map · **Transit** · Eat · Trip (not Money).
- Map, Gallery, Transport, Dining, Trip have no dark/mobile artboards (spec §2 claims every page has them) — build from tokens + nearest mobile pattern.

**Phase 1**
- Home: country headline/lede has no column; route showcase total time, fare range and "Pay with myki" note have no column on `journeys`. → add `country_intro` `content_blocks` + `journeys.total_text`, `journeys.fare_note_i18n`?
- Map: overview clusters per **city** in design vs per **neighbourhood** in spec; drawer photo needs `places.cover_media_id` (missing from §14); search field, zoom / my-location buttons, overview card, mobile bottom sheet with "N places in view" — ☑ UI folded in.
- Gallery: lightbox shows a photo-specific description → `gallery_photos.desc_i18n` missing; region chips mix regions and cities.
- Eat & Drink: design has a 3rd **Drinks** tab (winery, brewery, distillery, roastery, zero-proof) and drink filter only there; `place_type` and `venue_drinks` (no `spirits`) can't express it. Atmosphere set differs (Rooftop, Waterfront, Hidden, Wine bar, Cocktail lounge). Tabs show no counts in design.
- Money: retry button, AUD/NZD pair toggle, cross-rate quick rows, disclaimers, sticky mobile converter — ☑ folded in.
- Visa: official-sources list, lead-time bars per permission (no column), Keep planning block — ☑ folded in (lead time from `content_blocks.entry_timeline`); design shows no "report outdated" UI for `POST /feedback` and no last-verified date; eVisitor card missing from design.

**Phase 2/3 (record now, decide in those plans)**
- Transport: Intercity city option with lines lacking `city_id`; fare notes text; no no-result / 503 state in design.
- Dishes: country "both", multi-value `types[]` (Classics, Seafood…) vs single `type`; collection sub-items that aren't dishes.
- Prepare: packing advice text + tips, fact icons, airport option free text / "included" fare.
- My Trip: off-map summary text (bool only), no drag in design, no shared/read-only artboard.

## 5. Spec-internal issues found

- Missing FKs: `regions.cover_media_id`, `hero_slides.place_id`, `journeys.cover_media_id`, `scenic_routes.cover_media_id`, `transit_agencies.card_id`, `permission_types.official_link_id`.
- `places.price_level` allows 0–4, Eat & Drink filter is 1–4 (0 = free attraction — fine, but document it).
- `content_feedback` has `entity` free text and an anonymous endpoint — needs length caps.
- Only some tables listed under RLS §14.9; Supabase exposes every public table → RLS on all 59 (carried from foundation deviation 2).
- `link-check` / `stop-links` as Edge Functions vs FX as Vercel Cron = two job runtimes in Phase 1; plan uses Vercel Cron for both Phase 1 jobs.

## 6. Plan

Phase 1 → `docs/superpowers/plans/2026-10-25-travelausnz-phase-1.md` (10 tasks: schema v2, page map, Home, Map, Eat & Drink, Gallery, Money, Visa, admin CRUD, SEO). Phase 2 (Transport/OTP, Dishes, Prepare, newsletter) and Phase 3 (My Trip, more cities, PWA) get their own plans after Phase 1 lands and the §15 open questions are answered.

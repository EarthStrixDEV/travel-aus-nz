# TravelAusNZ

Thai-first travel guide for Australia and New Zealand. Next.js 15 (App Router) + next-intl (`/th`, `/en`), Supabase (Postgres + Auth + Storage), Tailwind v4.

## Prerequisites

- Node.js 22.22+, 24.15+ or 26+ (required by the test toolchain: Vitest, jsdom) and npm
- A hosted Supabase project for development. Docker is **not** required: the CLI runs against the linked hosted project.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

`.env.local` keys (see `.env.example`):

| Key | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only reads (e.g. admin audit log) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Error tracking; optional, inert when empty |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics; optional, no-op when empty |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Supabase CLI and `npm run test:db` |
| `SUPABASE_DB_URL` | Optional: direct Postgres URL for `npm run test:db` |

### Link the Supabase project

The CLI does not read `.env.local`, so export the two CLI keys in your shell first:

```bash
export SUPABASE_ACCESS_TOKEN=...   # personal access token (Dashboard > Account > Access Tokens)
export SUPABASE_DB_PASSWORD=...    # database password of the project
npx supabase link --project-ref <ref>
```

### Apply migrations

```bash
npx supabase db reset --linked --yes
```

> **Warning:** this wipes the linked database and re-applies every migration in `supabase/migrations` plus `supabase/seed.sql`. Use it only against the dev project. Check `supabase/.temp/project-ref` before running it.

Reference data (regions, MVP cities, currencies) is in a migration, so it exists in every environment; `seed.sql` is for dev-only sample data.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm test` | Unit/component tests (Vitest) |
| `npm run test:db` | pgTAP tests in `supabase/tests` against the linked DB (reads `.env.local`) |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` from the linked project |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Supabase Dashboard setup (one-time)

1. **Authentication > Sign In / Providers:** enable Email, Google and Apple (Google and Apple need their OAuth client credentials).
2. **Authentication > URL Configuration:** set the Site URL, and add these to the redirect allowlist:
   - `http://localhost:3000/**`
   - `http://localhost:3001/**`
3. **Promote an editor** (SQL Editor). Sign in once so the profile exists, then:

   ```sql
   update public.profiles
   set role = 'editor'   -- or 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   Editors can use `/th/admin`.

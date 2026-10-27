import 'server-only'
import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Client } from '@/lib/content/shared'
import { createClient } from '@/lib/supabase/server'
import { apiError } from './errors'
import { rateLimit } from './rate-limit'

/**
 * Guard for `/api/v1/me/*`: the verified signed-in user plus the cookie-bound client (RLS applies to every
 * query), or a 401 to return as-is. Route handlers never use the service client for user data.
 */
export async function requireApiUser(): Promise<{ user: User; db: Client } | NextResponse> {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return apiError('UNAUTHORIZED', 'Sign in required', 401)
  return { user, db }
}

/** `Cache-Control` for every user-data response (spec §3: user data = no-store). */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const

/** Thrown for a row the caller doesn't own (or that doesn't exist): always answered 404, never 403. */
export class NotFound extends Error {}

/**
 * Shared shell for `/me` handlers: rate limit on writes (60/min, prefix `me`), sign-in check, `NotFound` -> 404,
 * anything else -> 500 (logged). `fn` returns the success response.
 */
export async function meRoute(
  req: Request,
  opts: { write: boolean; label: string },
  fn: (ctx: { user: User; db: Client }) => Promise<Response>,
): Promise<Response> {
  if (opts.write) {
    const limited = await rateLimit(req, { limit: 60, window: '1 m', prefix: 'me' })
    if (limited) return limited
  }
  const auth = await requireApiUser()
  if (auth instanceof NextResponse) return auth
  try {
    return await fn(auth)
  } catch (err) {
    if (err instanceof NotFound) return apiError('NOT_FOUND', 'Not found', 404)
    console.error(`[me/${opts.label}] failed`, err)
    return apiError('INTERNAL', 'Something went wrong', 500)
  }
}

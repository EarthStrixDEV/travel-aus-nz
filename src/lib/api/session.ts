import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { NextResponse } from 'next/server'
import type { Client } from '@/lib/content/shared'
import { createClient } from '@/lib/supabase/server'
import { apiError } from './errors'

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

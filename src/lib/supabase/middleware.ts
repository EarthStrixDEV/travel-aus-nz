import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from './database.types'

export interface SessionUpdate {
  cookies: { name: string; value: string; options: CookieOptions }[]
  headers: Record<string, string>
}

/**
 * Validates/refreshes the Supabase session. Refreshed cookies are written onto
 * `request.cookies` (which rewrites the request `cookie` header) so anything that
 * forwards the request headers downstream sees them on this same request. The
 * returned update must then be applied to the final response.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  const update: SessionUpdate = { cookies: [], headers: {} }
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          update.cookies.push(...toSet)
          Object.assign(update.headers, headers)
        },
      },
    },
  )
  // Validates/refreshes the session; do not remove.
  await supabase.auth.getUser()
  return update
}

/** Writes the Set-Cookie values and cache headers from `updateSession` onto the response. */
export function applySessionUpdate(response: NextResponse, update: SessionUpdate): NextResponse {
  update.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  Object.entries(update.headers).forEach(([k, v]) => response.headers.set(k, v))
  return response
}

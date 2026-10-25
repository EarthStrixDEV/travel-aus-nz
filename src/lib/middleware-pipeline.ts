import type { NextRequest, NextResponse } from 'next/server'
import { setPathnameHeader } from '@/lib/auth/pathname-header'
import { applySessionUpdate, updateSession } from '@/lib/supabase/middleware'

/**
 * Order matters: refresh the Supabase session first (writes refreshed cookies onto the
 * request), set `x-pathname`, then run next-intl (which forwards the request headers
 * to server components), and finally copy Supabase's Set-Cookie + cache headers onto
 * next-intl's response.
 */
export async function runMiddleware(
  request: NextRequest,
  handleI18n: (request: NextRequest) => NextResponse,
): Promise<NextResponse> {
  const session = await updateSession(request)
  setPathnameHeader(request.headers, request.nextUrl.pathname + request.nextUrl.search)
  return applySessionUpdate(handleI18n(request), session)
}

import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { withPathnameHeader } from '@/lib/auth/pathname-header'
import { updateSession } from '@/lib/supabase/middleware'

const handleI18n = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  const response = handleI18n(request)
  withPathnameHeader(response, request.nextUrl.pathname + request.nextUrl.search)
  return updateSession(request, response)
}

export const config = {
  matcher: ['/((?!(?:api|auth)(?:/|$)|_next(?:/|$)|.*\\..*).*)'],
}

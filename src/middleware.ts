import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import { runMiddleware } from '@/lib/middleware-pipeline'

const handleI18n = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  return runMiddleware(request, handleI18n)
}

export const config = {
  matcher: ['/((?!(?:api|auth)(?:/|$)|_next(?:/|$)|.*\\..*).*)'],
}

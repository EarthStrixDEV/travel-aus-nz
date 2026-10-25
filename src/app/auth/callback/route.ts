import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-next'
import { defaultLocale, locales, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'

/** Locale for the login error page: first segment of the sanitised `next`, if supported. */
function failureLocale(next: string): Locale {
  const segment = next.split(/[/?#]/)[1]
  return locales.find((l) => l === segment) ?? defaultLocale
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Resolved against our own origin, so safeNextPath's same-origin guarantee holds.
      return NextResponse.redirect(new URL(next, origin))
    }
  }
  return NextResponse.redirect(new URL(`/${failureLocale(next)}/login?error=auth`, origin))
}

import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/safe-next'
import { defaultLocale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Resolved against our own origin, so safeNextPath's same-origin guarantee holds.
      return NextResponse.redirect(new URL(safeNextPath(searchParams.get('next')), origin))
    }
  }
  return NextResponse.redirect(new URL(`/${defaultLocale}/login?error=auth`, origin))
}

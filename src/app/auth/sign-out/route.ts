import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** POST only: a GET sign-out could be triggered cross-site by an <img> or link. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // 303 turns the POST into a GET on the target.
  return NextResponse.redirect(new URL('/', request.nextUrl.origin), 303)
}

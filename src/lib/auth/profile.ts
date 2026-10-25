import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { PATHNAME_HEADER } from './pathname-header'
import { safeNextPath } from './safe-next'

export type Profile = Database['public']['Tables']['profiles']['Row']

/** The signed-in user's profile row, or null when signed out. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return data ?? null
}

/**
 * Guard for pages under `[locale]`. Signed out -> login (round-trips back via `next`);
 * signed in without an allowed role -> 404 so the route's existence isn't revealed.
 */
export async function requireRole(roles: Profile['role'][]): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) {
    const locale = await getLocale()
    const current = (await headers()).get(PATHNAME_HEADER)
    const next = current ? safeNextPath(current) : '/'
    redirect({
      href: { pathname: '/login', query: { next: next === '/' ? `/${locale}` : next } },
      locale,
    })
    throw new Error('unreachable: redirect() throws') // next-intl types it as void
  }
  if (!roles.includes(profile.role)) notFound()
  return profile
}

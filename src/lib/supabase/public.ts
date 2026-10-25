import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Anonymous, cookie-less client for public content reads (RLS applies as `anon`).
 * Reads no cookies, so it is safe inside `unstable_cache` and statically rendered pages.
 */
export function createPublicClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

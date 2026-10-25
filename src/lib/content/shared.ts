import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import { t, type I18nText, type Locale } from '@/lib/i18n/t'
import { mediaUrl } from '@/lib/media/path'

export type Client = SupabaseClient<Database>
export type Country = 'au' | 'nz'
export type TransitMode = Database['public']['Enums']['transit_mode']

export const asI18n = (v: Json | null | undefined): I18nText => (v && typeof v === 'object' && !Array.isArray(v) ? (v as I18nText) : {})
export const text = (v: Json | null | undefined, locale: Locale): string => t(asI18n(v), locale)

export const toCountry = (c: string | null | undefined): Country | null => (c === 'AU' ? 'au' : c === 'NZ' ? 'nz' : null)

export type MediaRef = { url: string; alt: string }

export function toMedia(m: { path: string; alt_i18n: Json | null } | null | undefined, locale: Locale): MediaRef | null {
  return m ? { url: mediaUrl(m.path), alt: text(m.alt_i18n, locale) } : null
}

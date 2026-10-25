import type { Json } from '@/lib/supabase/database.types'

/** Helpers that turn DB rows into the string values an admin form starts from. */

export type FormValues = Record<string, string>

/** `{ th, en }` jsonb -> `{ [name_th]: th, [name_en]: en }`. */
export function i18nValues(value: Json | null | undefined, name: string): FormValues {
  const o = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    [`${name}_th`]: typeof o.th === 'string' ? o.th : '',
    [`${name}_en`]: typeof o.en === 'string' ? o.en : '',
  }
}

/** null/undefined -> '', anything else -> String(). */
export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Month names 1-12 in the UI locale, for `best_months` checkboxes. */
export function monthOptions(locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: fmt.format(Date.UTC(2026, i, 1)) }))
}

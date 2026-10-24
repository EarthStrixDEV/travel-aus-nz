export type Locale = 'th' | 'en'
export const locales: readonly Locale[] = ['th', 'en']
export const defaultLocale: Locale = 'th'

export type I18nText = Partial<Record<Locale, string>>

/** Resolve localized text: requested locale, then 'en', else ''. Empty strings count as missing. */
export function t(value: I18nText | null | undefined, locale: Locale): string {
  if (!value) return ''
  return value[locale] || value.en || ''
}

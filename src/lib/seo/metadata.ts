import type { Metadata } from 'next'
import { defaultLocale, locales, type Locale } from '@/lib/i18n/t'
import { siteUrl } from './site-url'

/** Absolute URL of `path` (`''` for the home page, else `/map`, `/eat-drink?venue=x`) in `locale`. */
export function localizedUrl(locale: Locale, path: string): string {
  return `${siteUrl()}/${locale}${path}`
}

/** `{ th: url, en: url }` for one path. */
export function localeUrls(path: string): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, localizedUrl(l, path)])) as Record<Locale, string>
}

/** Canonical + hreflang (th, en, x-default = the default locale) for a page. */
export function alternatesFor(locale: Locale, path: string) {
  const urls = localeUrls(path)
  return { canonical: localizedUrl(locale, path), languages: { ...urls, 'x-default': urls[defaultLocale] } }
}

export function pageMetadata(locale: string, path: string, meta: { title: string; description: string }): Metadata {
  return { title: meta.title, description: meta.description, alternates: alternatesFor(locale as Locale, path) }
}

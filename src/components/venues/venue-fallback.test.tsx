import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../messages/en.json'
import type { VenueCard } from '@/lib/venues/filter'
import { VenueFallback } from './venue-fallback'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...p }: Omit<ComponentProps<'a'>, 'href'> & { href: { pathname: string; query: Record<string, string> } }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} {...p} />
  ),
}))

const t = (key: string, values: Record<string, string | number> = {}) =>
  Object.entries(values).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en.eatDrink) as string,
  )

const v = (slug: string, name: string, kind: VenueCard['kind']): VenueCard => ({
  id: slug, slug, kind, name, city: { slug: 'sydney', name: 'Sydney' }, hood: 'Surry Hills', cuisine: { slug: 'x', name: 'Seafood' },
  priceLevel: 3, dietary: [], drinks: [], tags: [], description: '', menuHighlights: '', signatureDrinks: '', hours: [], hoursNote: '', stop: null,
})

describe('VenueFallback (server-rendered default view)', () => {
  it('puts restaurant names and map links in the HTML, and leaves bars out', () => {
    const html = renderToStaticMarkup(
      <VenueFallback venues={[v('saltbush', 'Saltbush Dining Room', 'restaurant'), v('hollow', 'Hollow Lane', 'bar')]} t={t} />,
    )
    expect(html).toContain('Saltbush Dining Room')
    expect(html).toContain('href="/map?place=saltbush"')
    expect(html).not.toContain('Hollow Lane')
  })
})

import { describe, expect, it } from 'vitest'
import { alternatesFor, pageMetadata } from './metadata'
import { sitemapEntries, sitemapIndexXml, urlsetXml } from './sitemap'

const BASE = 'http://localhost:3000'

describe('sitemapEntries', () => {
  it('destinations: home plus one map deep link per attraction, per locale', () => {
    const urls = sitemapEntries('destinations', { places: ['opera-house'], venues: ['hollow'] }).map((e) => e.loc)
    expect(urls).toContain(`${BASE}/th`)
    expect(urls).toContain(`${BASE}/en`)
    expect(urls).toContain(`${BASE}/th/map?place=opera-house`)
    expect(urls).toContain(`${BASE}/en/map?place=opera-house`)
    expect(urls.some((u) => u.includes('hollow'))).toBe(false)
  })

  it('venues: one eat-drink deep link per venue, per locale', () => {
    const urls = sitemapEntries('venues', { places: ['opera-house'], venues: ['hollow'] }).map((e) => e.loc)
    expect(urls).toContain(`${BASE}/th/eat-drink?venue=hollow`)
    expect(urls).toContain(`${BASE}/en/eat-drink?venue=hollow`)
    expect(urls.some((u) => u.includes('opera-house'))).toBe(false)
  })

  it('gallery: the gallery page in both locales', () => {
    expect(sitemapEntries('gallery', { places: [], venues: [] }).map((e) => e.loc)).toEqual([`${BASE}/th/gallery`, `${BASE}/en/gallery`])
  })

  it('dishes: the dishes page plus one detail page per dish, per locale', () => {
    const urls = sitemapEntries('dishes', { places: [], venues: [], dishes: ['pavlova'] }).map((e) => e.loc)
    expect(urls).toEqual([`${BASE}/th/dishes`, `${BASE}/en/dishes`, `${BASE}/th/dishes/pavlova`, `${BASE}/en/dishes/pavlova`])
  })

  it('every entry links its th and en alternates', () => {
    for (const e of sitemapEntries('venues', { places: [], venues: ['hollow'] }).filter((x) => x.loc.includes('venue='))) {
      expect(e.alternates).toEqual({ th: `${BASE}/th/eat-drink?venue=hollow`, en: `${BASE}/en/eat-drink?venue=hollow` })
    }
  })
})

describe('xml', () => {
  it('urlsetXml escapes & and emits hreflang links', () => {
    const xml = urlsetXml(sitemapEntries('venues', { places: [], venues: ['a&b'] }))
    expect(xml).toContain('<loc>http://localhost:3000/th/eat-drink?venue=a%26b</loc>')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="http://localhost:3000/en/eat-drink?venue=a%26b"/>')
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })

  it('sitemapIndexXml lists every sitemap', () => {
    const xml = sitemapIndexXml()
    for (const k of ['destinations', 'venues', 'gallery', 'dishes']) expect(xml).toContain(`<loc>${BASE}/sitemaps/${k}.xml</loc>`)
    expect(xml).toContain('<sitemapindex')
  })
})

describe('page metadata', () => {
  it('alternates are absolute, per page, with x-default', () => {
    expect(alternatesFor('en', '/map')).toEqual({
      canonical: `${BASE}/en/map`,
      languages: { th: `${BASE}/th/map`, en: `${BASE}/en/map`, 'x-default': `${BASE}/th/map` },
    })
    expect(alternatesFor('th', '').canonical).toBe(`${BASE}/th`)
  })

  it('pageMetadata carries title, description and alternates', () => {
    const m = pageMetadata('en', '/money', { title: 'Money', description: 'D' })
    expect(m.title).toBe('Money')
    expect(m.description).toBe('D')
    expect(m.alternates?.canonical).toBe(`${BASE}/en/money`)
  })
})

import { describe, expect, it } from 'vitest'
import { decodeCursor } from '@/lib/api/cursor'
import { photo } from './fixtures'
import {
  filterGallery,
  galleryFilterToParams,
  galleryOptions,
  hasActiveFilters,
  paginateGallery,
  parseGalleryFilter,
  typeSlug,
} from './filter'

const LIST = [
  photo('bondi', { sort: 1, season: 'summer', type: 'beach', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('opera', { sort: 2, season: 'winter', type: 'heritage', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('cradle', { sort: 3, season: 'winter', type: 'mountain', region: { slug: 'tasmania', name: 'Tasmania' } }),
  photo('hosier', { sort: 4, season: 'winter', type: 'city', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('nothing', { sort: 5, season: null, type: null, typeLabel: null, region: null }),
]

describe('filterGallery', () => {
  it('returns everything for an empty filter, in the given order', () => {
    expect(filterGallery(LIST, {}).map((p) => p.place.slug)).toEqual(['bondi', 'opera', 'cradle', 'hosier', 'nothing'])
  })

  it('season + region is an intersection and keeps sort order', () => {
    const out = filterGallery(LIST, { season: 'winter', region: 'sydney' })
    expect(out.map((p) => p.place.slug)).toEqual(['opera', 'hosier'])
  })

  it('type narrows further', () => {
    expect(filterGallery(LIST, { season: 'winter', region: 'sydney', type: 'city' }).map((p) => p.place.slug)).toEqual(['hosier'])
  })

  it('no match -> []', () => {
    expect(filterGallery(LIST, { season: 'spring', region: 'tasmania' })).toEqual([])
  })

  it('a photo without a region / type / season never matches that filter', () => {
    expect(filterGallery(LIST, { region: 'sydney' }).some((p) => p.place.slug === 'nothing')).toBe(false)
    expect(filterGallery(LIST, { type: 'beach' }).some((p) => p.place.slug === 'nothing')).toBe(false)
    expect(filterGallery(LIST, { season: 'winter' }).some((p) => p.place.slug === 'nothing')).toBe(false)
  })
})

describe('URL <-> filter', () => {
  it('parses known values and drops unknown ones', () => {
    expect(parseGalleryFilter(new URLSearchParams('region=sydney&type=wine-region&season=winter'))).toEqual({
      region: 'sydney',
      type: 'wine-region',
      season: 'winter',
    })
    expect(parseGalleryFilter(new URLSearchParams('region=%3Cscript%3E&type=&season=monsoon'))).toEqual({
      region: undefined,
      type: undefined,
      season: undefined,
    })
  })

  it('round-trips, and the default serialises to nothing', () => {
    const f = { region: 'tasmania', type: 'mountain', season: 'winter' as const }
    expect(parseGalleryFilter(galleryFilterToParams(f))).toEqual(f)
    expect(galleryFilterToParams({}).toString()).toBe('')
    expect(hasActiveFilters({})).toBe(false)
    expect(hasActiveFilters({ season: 'summer' })).toBe(true)
  })
})

describe('galleryOptions', () => {
  it('lists the regions and types that exist, once each', () => {
    const o = galleryOptions(LIST)
    expect(o.regions).toEqual([
      { slug: 'sydney', name: 'Sydney' },
      { slug: 'tasmania', name: 'Tasmania' },
    ])
    expect(o.types.map((t) => t.slug)).toEqual(['beach', 'mountain', 'city', 'heritage'])
  })
})

describe('typeSlug', () => {
  it('slugs a place category', () => {
    expect(typeSlug('Wine region')).toBe('wine-region')
    expect(typeSlug(' Beach ')).toBe('beach')
  })
})

describe('paginateGallery', () => {
  it('pages by (sort, id) and hands out a cursor only when more remain', () => {
    const first = paginateGallery(LIST, { limit: 2 })
    expect(first.items.map((p) => p.place.slug)).toEqual(['bondi', 'opera'])
    expect(decodeCursor(first.nextCursor!)).toEqual({ sort: 2, id: 'id-opera' })

    const second = paginateGallery(LIST, { limit: 2, cursor: decodeCursor(first.nextCursor!)! })
    expect(second.items.map((p) => p.place.slug)).toEqual(['cradle', 'hosier'])

    const last = paginateGallery(LIST, { limit: 2, cursor: decodeCursor(second.nextCursor!)! })
    expect(last.items.map((p) => p.place.slug)).toEqual(['nothing'])
    expect(last.nextCursor).toBeNull()
  })

  it('exactly limit items left -> no cursor', () => {
    expect(paginateGallery(LIST, { limit: 5 }).nextCursor).toBeNull()
  })
})

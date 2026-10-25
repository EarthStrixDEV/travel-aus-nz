import { describe, expect, it } from 'vitest'
import { placeJsonLd, placesJsonLd, serializeJsonLd, type SeoPlace } from './jsonld'

function place(over: Partial<SeoPlace> = {}): SeoPlace {
  return {
    slug: 'hollow',
    type: 'bar',
    name: 'Hollow',
    description: 'A hidden bar.',
    area: 'Surry Hills',
    city: 'Sydney',
    country: 'au',
    lng: 151.21,
    lat: -33.88,
    hours: [{ weekday: 5, open: '18:00', close: '02:00' }],
    priceLevel: 3,
    website: 'https://hollow.example',
    ...over,
  }
}

describe('placeJsonLd', () => {
  it('maps the place type to the schema.org type', () => {
    expect(placeJsonLd(place({ type: 'bar' }), 'en')['@type']).toBe('BarOrPub')
    expect(placeJsonLd(place({ type: 'restaurant' }), 'en')['@type']).toBe('Restaurant')
    expect(placeJsonLd(place({ type: 'cafe' }), 'en')['@type']).toBe('CafeOrCoffeeShop')
    expect(placeJsonLd(place({ type: 'attraction' }), 'en')['@type']).toBe('TouristAttraction')
  })

  it('emits one specification for Fri 18:00-02:00 without wrapping the close time', () => {
    const ld = placeJsonLd(place(), 'en')
    expect(ld.openingHoursSpecification).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Friday', opens: '18:00', closes: '02:00' },
    ])
  })

  it('merges days that share the same hours', () => {
    const hours = [1, 2, 3].map((weekday) => ({ weekday, open: '09:00', close: '17:00' }))
    const spec = placeJsonLd(place({ hours }), 'en').openingHoursSpecification as { dayOfWeek: unknown }[]
    expect(spec).toHaveLength(1)
    expect(spec[0].dayOfWeek).toEqual(['Monday', 'Tuesday', 'Wednesday'])
  })

  it('renders price_level as dollar signs and omits it when unknown', () => {
    expect(placeJsonLd(place({ priceLevel: 3 }), 'en').priceRange).toBe('$$$')
    expect(placeJsonLd(place({ priceLevel: 4 }), 'en').priceRange).toBe('$$$$')
    expect(placeJsonLd(place({ priceLevel: null }), 'en')).not.toHaveProperty('priceRange')
    expect(placeJsonLd(place({ priceLevel: 0 }), 'en')).not.toHaveProperty('priceRange')
  })

  it('includes geo, address area, and a locale URL', () => {
    const ld = placeJsonLd(place(), 'th')
    expect(ld.geo).toEqual({ '@type': 'GeoCoordinates', latitude: -33.88, longitude: 151.21 })
    expect(ld.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Surry Hills', addressCountry: 'AU' })
    expect(ld.url).toBe('http://localhost:3000/th/eat-drink?venue=hollow')
    expect(placeJsonLd(place({ type: 'attraction', slug: 'opera-house' }), 'en').url).toBe('http://localhost:3000/en/map?place=opera-house')
  })

  it('omits empty hours, description and website', () => {
    const ld = placeJsonLd(place({ hours: [], description: '', website: null }), 'en')
    expect(ld).not.toHaveProperty('openingHoursSpecification')
    expect(ld).not.toHaveProperty('description')
    expect(ld).not.toHaveProperty('sameAs')
  })
})

describe('placesJsonLd', () => {
  it('wraps places in an ItemList', () => {
    const ld = placesJsonLd([place(), place({ slug: 'two' })], 'en')
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('ItemList')
    expect(ld.itemListElement).toHaveLength(2)
    expect(ld.itemListElement[1]).toMatchObject({ '@type': 'ListItem', position: 2, item: { '@type': 'BarOrPub' } })
  })
})

describe('serializeJsonLd', () => {
  it('escapes < so a value cannot close the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c/script>')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' })
  })
})

import { describe, expect, it } from 'vitest'
import { blurDataUrl, IMAGE_WIDTHS, imageSizes, mediaPath } from './path'

it('builds bucket key', () =>
  expect(mediaPath('places', 'abc', 'f00')).toBe('places/abc/f00.webp'))

describe('image sizes', () => {
  it('serves 480 / 960 / 1920 only', () => expect(IMAGE_WIDTHS).toEqual([480, 960, 1920]))

  it('maps layout to a sizes attribute, one per layout', () => {
    expect(imageSizes('grid')).toMatch(/vw/)
    expect(imageSizes('lightbox')).not.toBe(imageSizes('grid'))
  })
})

describe('blurDataUrl', () => {
  it('is undefined without a (valid) blurhash', () => {
    expect(blurDataUrl(null)).toBeUndefined()
    expect(blurDataUrl('')).toBeUndefined()
    expect(blurDataUrl('short')).toBeUndefined()
  })

  it('paints the blurhash average colour into a tiny SVG', () => {
    // Chars 2-5 of the hash ("HV6n") are the base-83 DC value 17*83^3 + 31*83^2 + 6*83 + 49 = 9934485 = 0x979695.
    const url = blurDataUrl('LEHV6nWB2yk8pyo0adR*.7kCMdnj')!
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/)
    const svg = Buffer.from(url.split(',')[1], 'base64').toString()
    expect(svg).toContain('fill="rgb(151,150,149)"')
  })
})

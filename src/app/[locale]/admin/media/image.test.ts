import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { inspectImage, UnsupportedImage } from './image'

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })

describe('inspectImage', () => {
  it.each([
    ['jpeg', 'image/jpeg', 'jpg'],
    ['png', 'image/png', 'png'],
    ['webp', 'image/webp', 'webp'],
    ['avif', 'image/avif', 'avif'],
  ] as const)('accepts %s from its bytes and reports its real type', async (format, contentType, ext) => {
    const out = await inspectImage(await solid(64, 32).toFormat(format).toBuffer())
    expect(out).toMatchObject({ contentType, ext, width: 64, height: 32 })
    expect(out.hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('derives an 8 px base64 WebP blurDataURL', async () => {
    const out = await inspectImage(await solid(64, 32).png().toBuffer())
    expect(out.blurDataURL).toMatch(/^data:image\/webp;base64,/)
    const meta = await sharp(Buffer.from(out.blurDataURL.split(',')[1], 'base64')).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBe(8)
  })

  it('reports display dimensions for an EXIF-rotated photo', async () => {
    const out = await inspectImage(await solid(60, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer())
    expect(out).toMatchObject({ width: 20, height: 60 })
  })

  it('does not downscale: dimensions are the original’s', async () => {
    expect(await inspectImage(await solid(3000, 1500).jpeg().toBuffer())).toMatchObject({ width: 3000, height: 1500 })
  })

  it('rejects GIF, SVG and non-image bytes whatever they claim to be', async () => {
    const gif = await solid(8, 8).gif().toBuffer()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>')
    for (const bytes of [gif, svg, Buffer.from('not an image')]) {
      await expect(inspectImage(bytes)).rejects.toBeInstanceOf(UnsupportedImage)
    }
  })
})

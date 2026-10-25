import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { processImage } from './image'

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer()

describe('processImage', () => {
  it('re-encodes as WebP, keeps dimensions and hashes the output', async () => {
    const out = await processImage(await png(64, 32))
    expect(out).toMatchObject({ width: 64, height: 32 })
    expect((await sharp(out.data).metadata()).format).toBe('webp')
    expect(out.hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('derives an 8 px base64 WebP blurDataURL', async () => {
    const out = await processImage(await png(64, 32))
    expect(out.blurDataURL).toMatch(/^data:image\/webp;base64,/)
    const meta = await sharp(Buffer.from(out.blurDataURL.split(',')[1], 'base64')).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBe(8)
  })

  it('caps the longest edge at 2560 px', async () => {
    const out = await processImage(await png(3000, 1500))
    expect(out).toMatchObject({ width: 2560, height: 1280 })
  })

  it('rejects bytes that are not an image', async () => {
    await expect(processImage(Buffer.from('not an image'))).rejects.toThrow()
  })
})

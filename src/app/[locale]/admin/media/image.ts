import { createHash } from 'node:crypto'
import sharp from 'sharp'

export type ProcessedImage = {
  data: Buffer
  width: number
  height: number
  /** Content hash (16 hex) for the Storage object key. */
  hash: string
  /** Tiny base64 WebP for `next/image` `placeholder="blur"`; stored in `media_assets.blurhash`. */
  blurDataURL: string
}

/** Longest edge kept; the image CDN serves at most 1920 px (see lib/media/path.ts). */
const MAX_EDGE = 2560

/**
 * Normalise an upload: honour EXIF orientation, cap the size, re-encode as WebP (matching
 * `mediaPath`'s `.webp` keys), and derive the 8 px blur placeholder server-side.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const { data, info } = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  const blur = await sharp(data).resize(8, 8, { fit: 'inside' }).webp({ quality: 50 }).toBuffer()
  return {
    data,
    width: info.width,
    height: info.height,
    hash: createHash('sha256').update(data).digest('hex').slice(0, 16),
    blurDataURL: `data:image/webp;base64,${blur.toString('base64')}`,
  }
}

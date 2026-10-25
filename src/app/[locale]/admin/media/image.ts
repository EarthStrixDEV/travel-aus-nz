import { createHash } from 'node:crypto'
import sharp, { type Metadata } from 'sharp'

export type InspectedImage = {
  /** Real content type, from the decoded header (the browser's `file.type` is not trusted). */
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
  ext: 'jpg' | 'png' | 'webp' | 'avif'
  /** Display size, i.e. after EXIF orientation (next/image's optimizer auto-rotates). */
  width: number
  height: number
  /** Content hash (16 hex) of the original bytes, for the Storage object key. */
  hash: string
  /** Tiny base64 WebP for `next/image` `placeholder="blur"`; stored in `media_assets.blurhash`. */
  blurDataURL: string
}

const FORMATS = {
  jpeg: { contentType: 'image/jpeg', ext: 'jpg' },
  png: { contentType: 'image/png', ext: 'png' },
  webp: { contentType: 'image/webp', ext: 'webp' },
} as const

/**
 * Spec §6: the original is stored unchanged and the image CDN derives sizes from it. This
 * only reads the header to validate the real format against the allowlist and to get the
 * dimensions, and derives the 8 px blur placeholder server-side. Throws `UnsupportedImage`
 * for formats outside the allowlist (GIF, SVG, TIFF…) and on undecodable bytes.
 */
export async function inspectImage(input: Buffer): Promise<InspectedImage> {
  let meta: Metadata
  try {
    meta = await sharp(input, { limitInputPixels: 100_000_000 }).metadata()
  } catch {
    throw new UnsupportedImage()
  }
  const kind = kindOf(meta)
  if (!kind || !meta.width || !meta.height) throw new UnsupportedImage()

  const rotated = (meta.orientation ?? 1) >= 5
  const blur = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(8, 8, { fit: 'inside' })
    .webp({ quality: 50 })
    .toBuffer()
  return {
    ...kind,
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
    hash: createHash('sha256').update(input).digest('hex').slice(0, 16),
    blurDataURL: `data:image/webp;base64,${blur.toString('base64')}`,
  }
}

function kindOf(meta: Metadata): Pick<InspectedImage, 'contentType' | 'ext'> | null {
  // sharp reports AVIF as `heif` with AV1 compression; other HEIF (HEIC) is not web-servable.
  if (meta.format === 'heif') return meta.compression === 'av1' ? { contentType: 'image/avif', ext: 'avif' } : null
  return Object.hasOwn(FORMATS, meta.format) ? FORMATS[meta.format as keyof typeof FORMATS] : null
}

export class UnsupportedImage extends Error {
  constructor() {
    super('Unsupported or unreadable image')
  }
}

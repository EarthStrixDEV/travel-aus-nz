/** Bucket-relative object key inside the Supabase `media` bucket. */
export function mediaPath(entity: string, id: string, hash: string): string {
  return `${entity}/${id}/${hash}.webp`
}

/** Public URL of an object in the `media` bucket (e.g. a `media_assets.path`). */
export function mediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`
}

/** The only widths the image CDN serves (spec §6 media rules); mirrored by `images.deviceSizes` in next.config.ts. */
export const IMAGE_WIDTHS = [480, 960, 1920] as const

/** `sizes` attribute per layout, so the browser picks the 480 / 960 / 1920 variant that fits. */
export function imageSizes(layout: 'grid' | 'lightbox'): string {
  return layout === 'grid'
    ? '(min-width: 1440px) 420px, (min-width: 768px) 33vw, 100vw'
    : '(min-width: 768px) calc(100vw - 400px), 100vw'
}

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

/**
 * Next `blurDataURL` derived from a blurhash: a 1x1 SVG filled with the hash's average colour
 * (its DC component, characters 2-5, stored as plain sRGB bytes). `next/image` blurs it up.
 * Undefined when the hash is missing or malformed, so callers fall back to no placeholder.
 */
export function blurDataUrl(blurhash: string | null | undefined): string | undefined {
  if (!blurhash || blurhash.length < 6) return undefined
  let dc = 0
  for (const ch of blurhash.slice(2, 6)) {
    const digit = BASE83.indexOf(ch)
    if (digit < 0) return undefined
    dc = dc * 83 + digit
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="rgb(${dc >> 16},${(dc >> 8) & 255},${dc & 255})"/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

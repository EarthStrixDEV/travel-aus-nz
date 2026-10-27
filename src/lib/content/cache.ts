import { unstable_cache } from 'next/cache'

export const CACHE_TAGS = {
  home: 'home',
  map: 'map',
  venues: 'venues',
  gallery: 'gallery',
  fx: 'fx',
  entry: 'entry',
  transport: 'transport',
  dishes: 'dishes',
  prepare: 'prepare',
} as const

/** Wraps `unstable_cache` with a named tag so server actions can `revalidateTag(CACHE_TAGS.x)`. */
export function cachedContent<T>(
  key: string[],
  tag: keyof typeof CACHE_TAGS,
  fn: () => Promise<T>,
  revalidate = 3600,
): () => Promise<T> {
  return unstable_cache(fn, key, { tags: [CACHE_TAGS[tag]], revalidate })
}

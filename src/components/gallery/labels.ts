import { TYPE_SLUGS, type GalleryPhoto } from '@/lib/gallery/filter'

/** `t` scoped to the `gallery` namespace (next-intl's on the client, a plain lookup on the server). */
export type T = (key: string, values?: Record<string, string | number>) => string

/** Translated type when the category is a known slug, else the label as stored on the place. */
export function typeName(type: string | null, storedLabel: string | null, t: T): string {
  return type && (TYPE_SLUGS as readonly string[]).includes(type) ? t(`type.${type}`) : (storedLabel ?? '')
}

export const seasonName = (season: GalleryPhoto['season'], t: T): string => (season ? t(`season.${season}`) : '')

/** Second caption line: "Sydney · Summer". */
export function caption(photo: GalleryPhoto, t: T): string {
  return [photo.region?.name, seasonName(photo.season, t)].filter(Boolean).join(' · ')
}

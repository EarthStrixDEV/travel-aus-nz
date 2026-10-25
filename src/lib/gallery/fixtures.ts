import type { GalleryPhoto } from './filter'

/** Test factory: a published, fully populated photo. Override only what the test cares about. */
export function photo(slug: string, over: Partial<Omit<GalleryPhoto, 'place' | 'image'>> & { place?: Partial<GalleryPhoto['place']>; image?: Partial<GalleryPhoto['image']> } = {}): GalleryPhoto {
  const { place, image, ...rest } = over
  return {
    id: `id-${slug}`,
    title: `Title ${slug}`,
    sort: 0,
    season: 'summer',
    region: { slug: 'sydney', name: 'Sydney' },
    type: 'beach',
    typeLabel: 'Beach',
    image: { url: `https://cdn.test/media/${slug}.jpg`, alt: `Alt ${slug}`, width: 1200, height: 1500, ...image },
    place: {
      id: `place-${slug}`,
      slug,
      name: `Place ${slug}`,
      description: `About ${slug}`,
      bestTime: `Best ${slug}`,
      access: `Access ${slug}`,
      nearby: [],
      ...place,
    },
    ...rest,
  }
}

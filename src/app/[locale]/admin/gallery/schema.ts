import { z } from 'zod'
import { i18nRequired, int, licensedMedia, mediaList, status, uuid } from '../_lib/form'

export const SEASONS = ['summer', 'autumn', 'winter', 'spring'] as const

export const galleryPhotoSchema = z
  .object({
    media_id: uuid,
    place_id: uuid,
    region_id: int(1, 2147483647).optional(),
    season: z.enum(SEASONS, 'choice').optional(),
    ...i18nRequired('title'),
    sort: int(-32768, 32767).default(0),
    status,
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'media_id'))

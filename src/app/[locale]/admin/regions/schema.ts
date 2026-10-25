import { z } from 'zod'
import { country, i18nOptional, i18nRequired, int, licensedMedia, many, mediaList, slug, status, uuid } from '../_lib/form'

export const regionSchema = z
  .object({
    country,
    slug,
    ...i18nRequired('name'),
    ...i18nOptional('state'),
    ...i18nOptional('lede'),
    best_months: many(int(1, 12)),
    featured_rank: int(0, 32767).optional(),
    cover_media_id: uuid.optional(),
    status,
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.status === 'published', 'cover_media_id'))

export type RegionInput = z.infer<typeof regionSchema>

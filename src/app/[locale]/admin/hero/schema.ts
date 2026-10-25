import { z } from 'zod'
import { checkbox, i18nRequired, int, licensedMedia, mediaList, uuid } from '../_lib/form'

// hero_slides has no status column: `active` is what puts a slide on the public home page.
export const heroSlideSchema = z
  .object({
    media_id: uuid,
    ...i18nRequired('caption'),
    place_id: uuid.optional(),
    sort: int(-2147483648, 2147483647).default(0),
    active: checkbox,
    media: mediaList,
  })
  .superRefine(licensedMedia((d) => d.active, 'media_id'))

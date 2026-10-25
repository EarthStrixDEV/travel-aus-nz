import { z } from 'zod'

let zones: Set<string> | undefined

/** True for IANA zone names such as `Australia/Sydney`; offsets like `UTC+10` are rejected. */
export function isIanaZone(tz: string): boolean {
  zones ??= new Set(Intl.supportedValuesOf('timeZone'))
  return zones.has(tz)
}

export const citySchema = z.object({
  region_id: z.coerce.number().int(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name_th: z.string().min(1),
  name_en: z.string().min(1),
  timezone: z.string().refine(isIanaZone),
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
  status: z.enum(['draft', 'published', 'archived']),
})

export type CityInput = z.infer<typeof citySchema>

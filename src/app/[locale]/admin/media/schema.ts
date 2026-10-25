import { z } from 'zod'
import { i18nRequired } from '../_lib/form'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/** Credit and license are required on every asset: published content may only show licensed media. */
export const mediaAssetSchema = z.object({
  credit: z.string().min(1, 'required').max(300, 'tooLong'),
  license: z.string().min(1, 'required').max(300, 'tooLong'),
  ...i18nRequired('alt'),
})

/** The uploaded file's problem as an `admin.errors.*` key, or null when acceptable. */
export function checkUpload(file: File | null): 'fileRequired' | 'fileType' | 'fileTooLarge' | null {
  if (!file || file.size === 0) return 'fileRequired'
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) return 'fileType'
  if (file.size > MAX_UPLOAD_BYTES) return 'fileTooLarge'
  return null
}

import { z } from 'zod'
import { i18nRequired } from '../_lib/form'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
/** For the file input's `accept` hint only; the server checks the decoded format. */
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

/** Credit and license are required on every asset: published content may only show licensed media. */
export const mediaAssetSchema = z.object({
  credit: z.string().min(1, 'required').max(300, 'tooLong'),
  license: z.string().min(1, 'required').max(300, 'tooLong'),
  ...i18nRequired('alt'),
})

/**
 * Presence and size of the upload as an `admin.errors.*` key, or null when acceptable. The
 * format is checked from the decoded bytes in `inspectImage`, not from the browser's `file.type`.
 */
export function checkUpload(file: File | null): 'fileRequired' | 'fileTooLarge' | null {
  if (!file || file.size === 0) return 'fileRequired'
  if (file.size > MAX_UPLOAD_BYTES) return 'fileTooLarge'
  return null
}

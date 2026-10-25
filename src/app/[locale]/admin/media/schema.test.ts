import { describe, expect, it } from 'vitest'
import { checkUpload, mediaAssetSchema, MAX_UPLOAD_BYTES } from './schema'

const asset = { credit: 'Jane Doe / Unsplash', license: 'Unsplash License', alt_th: 'อ่าว', alt_en: 'Harbour at dawn' }

describe('mediaAssetSchema', () => {
  it('parses valid input', () => {
    expect(mediaAssetSchema.safeParse(asset).success).toBe(true)
  })
  it('requires credit and license', () => {
    expect(mediaAssetSchema.safeParse({ ...asset, credit: '' }).success).toBe(false)
    expect(mediaAssetSchema.safeParse({ ...asset, license: undefined }).success).toBe(false)
  })
  it('rejects a missing English alt text', () => {
    expect(mediaAssetSchema.safeParse({ ...asset, alt_en: undefined }).success).toBe(false)
  })
})

describe('checkUpload', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type })
  it('accepts a non-empty file within the size cap (format is checked from the bytes later)', () => {
    expect(checkUpload(file('image/jpeg', 10))).toBeNull()
  })
  it('rejects a missing/empty file and oversized files', () => {
    expect(checkUpload(null)).toBe('fileRequired')
    expect(checkUpload(file('image/jpeg', 0))).toBe('fileRequired')
    expect(checkUpload(file('image/jpeg', MAX_UPLOAD_BYTES + 1))).toBe('fileTooLarge')
  })
})

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
  it('accepts JPEG, PNG, WebP and AVIF within the size cap', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif']) expect(checkUpload(file(type, 10))).toBeNull()
  })
  it('rejects a missing/empty file, other types and oversized files', () => {
    expect(checkUpload(null)).toBe('fileRequired')
    expect(checkUpload(file('image/jpeg', 0))).toBe('fileRequired')
    expect(checkUpload(file('image/svg+xml', 10))).toBe('fileType')
    expect(checkUpload(file('image/jpeg', MAX_UPLOAD_BYTES + 1))).toBe('fileTooLarge')
  })
})

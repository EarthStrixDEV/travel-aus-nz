import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, upload, remove, insert, createClient } = vi.hoisted(() => {
  const upload = vi.fn()
  const remove = vi.fn()
  const insert = vi.fn()
  return {
    requireRole: vi.fn(),
    upload,
    remove,
    insert,
    createClient: vi.fn(async () => ({
      storage: { from: () => ({ upload, remove }) },
      from: () => ({ insert }),
    })),
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { uploadMedia } from './upload'

const jpeg = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#c87828' } }).jpeg().toBuffer()

async function form(over: Record<string, string> = {}, file?: File) {
  const fd = new FormData()
  fd.set('file', file ?? new File([new Uint8Array(await jpeg())], 'harbour.jpg', { type: 'image/jpeg' }))
  for (const [k, v] of Object.entries({ credit: 'Jane Doe', license: 'CC BY 4.0', alt_th: 'อ่าว', alt_en: 'Harbour', ...over })) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  upload.mockResolvedValue({ error: null })
  remove.mockResolvedValue({ error: null })
  insert.mockResolvedValue({ error: null })
})

describe('uploadMedia', () => {
  it('checks the role first', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(uploadMedia(await form())).rejects.toThrow('NEXT_NOT_FOUND')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('stores the original bytes unchanged under assets/<id>/<hash>.<ext> with the real type, plus an 8 px blurDataURL', async () => {
    const original = await jpeg()
    const fd = await form({}, new File([new Uint8Array(original)], 'harbour.jpg', { type: 'image/jpeg' }))
    expect(await uploadMedia(fd)).toEqual({})
    const [path, body, opts] = upload.mock.calls[0]
    expect(path).toMatch(/^assets\/[0-9a-f-]{36}\/[0-9a-f]{16}\.jpg$/)
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: false })
    expect(Buffer.compare(Buffer.from(body), original)).toBe(0)
    const row = insert.mock.calls[0][0]
    expect(row).toMatchObject({
      path,
      width: 40,
      height: 30,
      credit: 'Jane Doe',
      license: 'CC BY 4.0',
      alt_i18n: { th: 'อ่าว', en: 'Harbour' },
    })
    expect(path).toContain(row.id)
    expect(row.blurhash).toMatch(/^data:image\/webp;base64,/)
  })

  it('trusts the bytes, not the browser type: a PNG labelled image/jpeg is stored as image/png', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).png().toBuffer()
    await uploadMedia(await form({}, new File([new Uint8Array(png)], 'x.jpg', { type: 'image/jpeg' })))
    expect(upload.mock.calls[0][0]).toMatch(/\.png$/)
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' })
  })

  it('a GIF or SVG renamed to .jpg is rejected before Storage', async () => {
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).gif().toBuffer()
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>')
    for (const bytes of [gif, svg]) {
      const r = await uploadMedia(await form({}, new File([new Uint8Array(bytes)], 'photo.jpg', { type: 'image/jpeg' })))
      expect(r.fieldErrors).toEqual({ file: 'errors.fileType' })
    }
    expect(upload).not.toHaveBeenCalled()
  })

  it('requires credit and license (and a file) before touching Storage', async () => {
    const r = await uploadMedia(await form({ credit: '', license: ' ' }, new File([], 'empty.png', { type: 'image/png' })))
    expect(r.fieldErrors).toEqual({ credit: 'errors.required', license: 'errors.required', file: 'errors.fileRequired' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('a failed row insert removes the uploaded object', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } })
    expect(await uploadMedia(await form())).toEqual({ error: 'errors.forbidden' })
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
  })

  it('a Storage failure -> upload error, no row', async () => {
    upload.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })
    expect(await uploadMedia(await form())).toEqual({ error: 'errors.uploadFailed' })
    expect(insert).not.toHaveBeenCalled()
  })
})

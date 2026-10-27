import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireRole, upsert, update, eq, maybeSingle, createClient, revalidateTag } = vi.hoisted(() => {
  const upsert = vi.fn()
  const eq = vi.fn()
  const update = vi.fn(() => ({ eq }))
  const maybeSingle = vi.fn()
  const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }))
  const from = vi.fn(() => ({ upsert, update, select }))
  return {
    requireRole: vi.fn(),
    upsert,
    update,
    eq,
    maybeSingle,
    createClient: vi.fn(async () => ({ from })),
    revalidateTag: vi.fn(),
  }
})

vi.mock('@/lib/auth/profile', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidateTag, revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { acceptOfficialLinkPage, saveOfficialLink } from './actions'

const URL_A = 'https://immi.homeaffairs.gov.au/'
const URL_B = 'https://www.homeaffairs.gov.au/visas'

function form(url: string) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ title_th: 'กระทรวง', title_en: 'Home Affairs', url })) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  requireRole.mockResolvedValue({ id: 'u1', role: 'editor' })
  upsert.mockResolvedValue({ error: null })
  eq.mockResolvedValue({ error: null })
  maybeSingle.mockResolvedValue({ data: { url: URL_A }, error: null })
})

describe('saveOfficialLink', () => {
  it('same URL -> leaves the link-check baseline alone', async () => {
    expect(await saveOfficialLink(1, form(URL_A))).toEqual({})
    const row = upsert.mock.calls[0][0]
    expect(row).toMatchObject({ id: 1, url: URL_A })
    expect(row).not.toHaveProperty('content_hash')
    expect(row).not.toHaveProperty('health_status')
  })

  it('changed URL -> resets the baseline so the next check adopts the new page', async () => {
    expect(await saveOfficialLink(1, form(URL_B))).toEqual({})
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 1, url: URL_B, content_hash: null, health_status: 'ok' }))
    expect(revalidateTag).toHaveBeenCalledWith('entry')
  })

  it('new link -> no lookup, no baseline fields', async () => {
    expect(await saveOfficialLink(null, form(URL_A))).toEqual({})
    expect(maybeSingle).not.toHaveBeenCalled()
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('content_hash')
  })

  it('off-list host -> field error, no write', async () => {
    const r = await saveOfficialLink(1, form('https://example.com/'))
    expect(r).toMatchObject({ fieldErrors: { url: expect.any(String) } })
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('acceptOfficialLinkPage', () => {
  const idForm = (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    return fd
  }

  it('unauthorized -> rethrows before any DB access', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(acceptOfficialLinkPage(idForm('1'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('clears the baseline and marks the link ok', async () => {
    await acceptOfficialLinkPage(idForm('7'))
    expect(update).toHaveBeenCalledWith({ content_hash: null, health_status: 'ok' })
    expect(eq).toHaveBeenCalledWith('id', 7)
    expect(revalidateTag).toHaveBeenCalledWith('entry')
  })

  it('invalid id -> no write', async () => {
    await acceptOfficialLinkPage(idForm('abc'))
    expect(update).not.toHaveBeenCalled()
  })
})

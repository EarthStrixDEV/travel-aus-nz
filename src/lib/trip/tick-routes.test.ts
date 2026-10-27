import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  rateLimit: vi.fn(),
  ownedTripId: vi.fn(),
  currentTripId: vi.fn(),
  writeTick: vi.fn(),
  readTicks: vi.fn(),
  clearTicks: vi.fn(),
}))

const DB = vi.hoisted(() => ({ auth: { getUser: () => m.getUser() } }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => DB }))
vi.mock('@/lib/api/rate-limit', () => ({ rateLimit: m.rateLimit }))
vi.mock('./current-trip', () => ({ ownedTripId: m.ownedTripId, currentTripId: m.currentTripId }))
vi.mock('./ticks', () => ({ writeTick: m.writeTick, readTicks: m.readTicks, clearTicks: m.clearTicks }))

import { getTicks, patchTick, resetTicks } from './tick-routes'

const MINE = '11111111-1111-4111-8111-111111111111'
const THEIRS = '22222222-2222-4222-8222-222222222222'

const patch = (body: unknown) =>
  new Request('http://x/api/v1/me/checklist-items/3', { method: 'PATCH', body: JSON.stringify(body) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  m.rateLimit.mockResolvedValue(null)
  m.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  m.ownedTripId.mockImplementation(async (_db, _u, id: string) => (id === MINE ? MINE : null))
  m.currentTripId.mockResolvedValue(MINE)
  m.readTicks.mockResolvedValue([1, 4])
})

describe('patchTick', () => {
  it('signed out -> 401 and no write', async () => {
    m.getUser.mockResolvedValue({ data: { user: null } })
    expect((await patchTick(patch({ done: true }), 'checklist', '3')).status).toBe(401)
    expect(m.writeTick).not.toHaveBeenCalled()
  })

  it("another user's trip -> 404 and no write", async () => {
    const res = await patchTick(patch({ trip_id: THEIRS, done: true }), 'checklist', '3')
    expect(res.status).toBe(404)
    expect(m.writeTick).not.toHaveBeenCalled()
  })

  it('own trip -> writes and echoes the tick, no-store', async () => {
    const res = await patchTick(patch({ trip_id: MINE, done: true }), 'checklist', '3')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ trip_id: MINE, id: 3, done: true })
    expect(m.writeTick).toHaveBeenCalledWith(DB, 'checklist', MINE, 3, true)
  })

  it('no trip_id -> the current trip, created if needed', async () => {
    await patchTick(patch({ packed: false }), 'packing', '9')
    expect(m.currentTripId).toHaveBeenCalledWith(DB, 'u1', { create: true })
    expect(m.writeTick).toHaveBeenCalledWith(DB, 'packing', MINE, 9, false)
  })

  it('bad body or item id -> 400; unknown item (FK) -> 404', async () => {
    expect((await patchTick(patch({ done: 'yes' }), 'checklist', '3')).status).toBe(400)
    expect((await patchTick(patch({ done: true }), 'checklist', 'abc')).status).toBe(400)
    m.writeTick.mockRejectedValue({ code: '23503' })
    expect((await patchTick(patch({ done: true }), 'checklist', '999')).status).toBe(404)
  })

  it('rate limited -> 429 before auth', async () => {
    m.rateLimit.mockResolvedValue(NextResponse.json({}, { status: 429 }))
    expect((await patchTick(patch({ done: true }), 'checklist', '3')).status).toBe(429)
    expect(m.getUser).not.toHaveBeenCalled()
  })
})

describe('getTicks / resetTicks', () => {
  it("another user's or a malformed trip id -> 404", async () => {
    expect((await getTicks(patch({}), 'checklist', THEIRS)).status).toBe(404)
    expect((await getTicks(patch({}), 'checklist', 'not-a-uuid')).status).toBe(404)
    expect((await resetTicks(patch({}), 'checklist', THEIRS)).status).toBe(404)
    expect(m.clearTicks).not.toHaveBeenCalled()
  })

  it('own trip -> ticked ids', async () => {
    const res = await getTicks(patch({}), 'checklist', MINE)
    expect(await res.json()).toEqual({ items: [{ template_id: 1, done: true }, { template_id: 4, done: true }] })
  })
})

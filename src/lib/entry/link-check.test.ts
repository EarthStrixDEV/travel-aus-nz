import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@/lib/content/shared'
import { checkLinks, pageTitleHash } from './link-check'

type Row = Record<string, unknown>

/** Just enough of the Supabase query builder for `checkLinks`: select/insert/update with eq/in/order/limit. */
function fakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed))
  let seq = 1000
  const db = {
    from(table: string) {
      const rows = (tables[table] ??= [])
      let op: 'select' | 'insert' | 'update' = 'select'
      let patch: Row | Row[] = {}
      let returning = false
      const filters: ((r: Row) => boolean)[] = []
      const orders: [string, boolean][] = []
      let max = Infinity
      const run = (): { data: Row[] | null; error: null } => {
        if (op === 'insert') {
          for (const r of ([] as Row[]).concat(patch)) rows.push({ id: ++seq, ...r })
          return { data: null, error: null }
        }
        const matched = rows.filter((r) => filters.every((f) => f(r)))
        if (op === 'update') {
          for (const r of matched) Object.assign(r, patch)
          return { data: returning ? matched.map((r) => ({ ...r })) : null, error: null }
        }
        const sorted = [...matched].sort((a, b) => {
          for (const [col, asc] of orders) {
            const x = String(a[col] ?? '')
            const y = String(b[col] ?? '')
            if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1)
          }
          return 0
        })
        return { data: sorted.slice(0, max).map((r) => ({ ...r })), error: null }
      }
      const b = {
        select: () => {
          if (op === 'update') returning = true
          return b
        },
        insert: (v: Row | Row[]) => {
          op = 'insert'
          patch = v
          return b
        },
        update: (v: Row) => {
          op = 'update'
          patch = v
          return b
        },
        eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), b),
        in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), b),
        order: (col: string, o?: { ascending?: boolean }) => (orders.push([col, o?.ascending !== false]), b),
        limit: (n: number) => ((max = n), b),
        maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      }
      return b
    },
  }
  return { db: db as unknown as Client, tables }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const page = (title: string, status = 200, url = '') => {
  const res = new Response(`<html><head><title>${title}</title></head><body>x</body></html>`, { status })
  if (url) Object.defineProperty(res, 'url', { value: url })
  return res
}

const redirect = (location: string, status = 301) => new Response(null, { status, headers: { location } })

const LINK_URL = 'https://immi.homeaffairs.gov.au'
const seed = (over: Record<string, Row[]> = {}) => ({
  official_links: [{ id: 1, url: LINK_URL, health_status: 'ok', content_hash: null, last_checked_at: null }],
  permission_types: [
    { id: 10, official_link_id: 1, needs_review: false },
    { id: 20, official_link_id: 2, needs_review: false },
  ],
  entry_rules: [
    { nationality: 'TH', permission_id: 10, needs_review: false },
    { nationality: 'SG', permission_id: 20, needs_review: false },
  ],
  link_checks: [],
  ...over,
})

const DAY1 = new Date('2026-10-25T02:00:00Z')
const DAY2 = new Date('2026-10-26T02:00:00Z')

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('pageTitleHash', () => {
  it('hashes the trimmed, whitespace-collapsed <title> and ignores the rest of the page', () => {
    expect(pageTitleHash('<html><TITLE>\n  Visitor   visa \n</TITLE><p>a</p>')).toBe(sha('Visitor visa'))
    expect(pageTitleHash('<title>Visitor visa</title><p>b</p>')).toBe(sha('Visitor visa'))
  })
  it('is null when there is no title', () => {
    expect(pageTitleHash('<html><body>nope</body></html>')).toBeNull()
  })
})

describe('checkLinks: broken', () => {
  it('one 404 is recorded but does not flag anything yet', async () => {
    const { db, tables } = fakeDb(seed())
    const fetchImpl = vi.fn(async () => page('Not found', 404))
    const result = await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)

    expect(result).toMatchObject({ checked: 1, flagged: 0 })
    expect(tables.link_checks).toHaveLength(1)
    expect(tables.link_checks[0]).toMatchObject({ link_id: 1, status_code: 404, content_hash: null })
    expect(tables.permission_types.every((p) => p.needs_review === false)).toBe(true)
    expect(tables.entry_rules.every((r) => r.needs_review === false)).toBe(true)
    expect(tables.official_links[0].health_status).toBe('ok')
    expect(tables.official_links[0].last_checked_at).toBe(DAY1.toISOString())
  })

  it('the second consecutive 404 sets needs_review on the referencing permission and its rules only', async () => {
    const { db, tables } = fakeDb(seed())
    const fetchImpl = vi.fn(async () => page('Not found', 404)) as unknown as typeof fetch
    await checkLinks(db, fetchImpl, DAY1)
    const result = await checkLinks(db, fetchImpl, DAY2)

    expect(result.flagged).toBe(1)
    expect(tables.official_links[0].health_status).toBe('broken')
    expect(tables.permission_types.find((p) => p.id === 10)?.needs_review).toBe(true)
    expect(tables.permission_types.find((p) => p.id === 20)?.needs_review).toBe(false)
    expect(tables.entry_rules.find((r) => r.nationality === 'TH')?.needs_review).toBe(true)
    expect(tables.entry_rules.find((r) => r.nationality === 'SG')?.needs_review).toBe(false)
  })

  it('a 404 followed by a 200 is not flagged and health returns to ok', async () => {
    const { db, tables } = fakeDb(seed())
    await checkLinks(db, (async () => page('x', 404)) as unknown as typeof fetch, DAY1)
    const result = await checkLinks(db, (async () => page('Home')) as unknown as typeof fetch, DAY2)
    expect(result.flagged).toBe(0)
    expect(tables.official_links[0].health_status).toBe('ok')
    expect(tables.permission_types.every((p) => p.needs_review === false)).toBe(true)
  })

  it('a network failure counts as a failed check (no status code), and the fetch has a 10 s abort signal', async () => {
    vi.useFakeTimers()
    const { db, tables } = fakeDb(seed())
    let signal: AbortSignal | undefined
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise<Response>((_res, rej) => signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
    })
    const pending = checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await pending

    expect(signal?.aborted).toBe(true)
    expect(tables.link_checks[0]).toMatchObject({ link_id: 1, status_code: null, content_hash: null })
  })

  it('one failing link does not stop the others', async () => {
    const { db, tables } = fakeDb(
      seed({
        official_links: [
          { id: 1, url: LINK_URL, health_status: 'ok', content_hash: null },
          { id: 2, url: 'https://www.immigration.govt.nz', health_status: 'ok', content_hash: null },
        ],
      }),
    )
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === LINK_URL) throw new TypeError('fetch failed')
      return page('INZ')
    })
    const result = await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(result.checked).toBe(2)
    expect(tables.link_checks.map((r) => r.status_code).sort()).toEqual([200, null])
  })
})

describe('checkLinks: page title hash', () => {
  it('follows redirects, records the final url and the title hash, and adopts the first hash as the baseline', async () => {
    const { db, tables } = fakeDb(seed())
    const fetchImpl = vi.fn(async (url: string) => (url === LINK_URL ? redirect('/en') : page('Home Affairs')))
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)

    expect(fetchImpl).toHaveBeenCalledWith(LINK_URL, expect.objectContaining({ method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal) }))
    expect(fetchImpl).toHaveBeenLastCalledWith('https://immi.homeaffairs.gov.au/en', expect.objectContaining({ redirect: 'manual' }))
    expect(tables.link_checks[0]).toMatchObject({ status_code: 200, final_url: 'https://immi.homeaffairs.gov.au/en', content_hash: sha('Home Affairs') })
    expect(tables.official_links[0]).toMatchObject({ content_hash: sha('Home Affairs'), health_status: 'ok' })
  })

  it('a changed title is flagged only when the previous check had also changed', async () => {
    const { db, tables } = fakeDb(seed({ official_links: [{ id: 1, url: LINK_URL, health_status: 'ok', content_hash: sha('Old title') }] }))
    const changed = (async () => page('New title')) as unknown as typeof fetch

    expect((await checkLinks(db, changed, DAY1)).flagged).toBe(0) // first day: differs from baseline, nothing before it
    expect(tables.permission_types.find((p) => p.id === 10)?.needs_review).toBe(false)

    expect((await checkLinks(db, changed, DAY2)).flagged).toBe(1) // second day in a row
    expect(tables.official_links[0].health_status).toBe('changed')
    expect(tables.official_links[0].content_hash).toBe(sha('Old title')) // baseline stays until an editor accepts the change
    expect(tables.permission_types.find((p) => p.id === 10)?.needs_review).toBe(true)
    expect(tables.entry_rules.find((r) => r.nationality === 'TH')?.needs_review).toBe(true)
  })

  it('an unchanged title never flags', async () => {
    const { db, tables } = fakeDb(seed({ official_links: [{ id: 1, url: LINK_URL, health_status: 'ok', content_hash: sha('Same') }] }))
    const same = (async () => page('Same')) as unknown as typeof fetch
    await checkLinks(db, same, DAY1)
    expect((await checkLinks(db, same, DAY2)).flagged).toBe(0)
    expect(tables.permission_types.every((p) => p.needs_review === false)).toBe(true)
  })
})

describe('checkLinks: host allowlist (SSRF)', () => {
  const linkTo = (url: string) => seed({ official_links: [{ id: 1, url, health_status: 'ok', content_hash: null }] })

  it.each([
    'https://169.254.169.254/latest/meta-data',
    'https://example.com/visa',
    'https://evilgov.au/',
    'https://immi.homeaffairs.gov.au.evil.com/',
    'http://immi.homeaffairs.gov.au/',
  ])('an off-list or non-https url (%s) is never fetched and is recorded as a failed check', async (url) => {
    const { db, tables } = fakeDb(linkTo(url))
    const fetchImpl = vi.fn(async () => page('x'))
    const result = await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.checked).toBe(1)
    expect(tables.link_checks[0]).toMatchObject({ link_id: 1, status_code: null, content_hash: null })
  })

  it('accepts gov.au, *.gov.au, govt.nz and *.govt.nz hosts', async () => {
    const urls = ['https://gov.au/', 'https://www.border.gov.au/', 'https://govt.nz/', 'https://www.immigration.govt.nz/']
    const { db } = fakeDb(seed({ official_links: urls.map((url, i) => ({ id: i + 1, url, health_status: 'ok', content_hash: null })) }))
    const fetchImpl = vi.fn(async () => page('ok'))
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(fetchImpl.mock.calls.map((c) => (c as unknown[])[0])).toEqual(urls)
  })

  it('a redirect to an off-list host is not followed and counts as a failed check (two in a row -> broken)', async () => {
    const { db, tables } = fakeDb(seed())
    const fetchImpl = vi.fn(async (url: string) => (url === LINK_URL ? redirect('http://10.0.0.1/admin', 302) : page('internal')))
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(tables.link_checks[0]).toMatchObject({ status_code: null, final_url: 'http://10.0.0.1/admin', content_hash: null })

    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(tables.official_links[0].health_status).toBe('broken')
  })

  it('an allowlisted redirect chain is followed (relative and absolute Location)', async () => {
    const { db, tables } = fakeDb(seed())
    const hops: Record<string, Response | (() => Response)> = {}
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === LINK_URL) return redirect('https://www.homeaffairs.gov.au/visas', 308)
      if (url === 'https://www.homeaffairs.gov.au/visas') return redirect('/visas/visitor', 302)
      return page('Visitor visa')
    })
    void hops
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(tables.link_checks[0]).toMatchObject({
      status_code: 200,
      final_url: 'https://www.homeaffairs.gov.au/visas/visitor',
      content_hash: sha('Visitor visa'),
    })
  })

  it('gives up after 5 redirects (failed check)', async () => {
    const { db, tables } = fakeDb(seed())
    let n = 0
    const fetchImpl = vi.fn(async () => redirect(`/hop${++n}`))
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1)
    expect(fetchImpl).toHaveBeenCalledTimes(6) // the original request + 5 followed redirects
    expect(tables.link_checks[0]).toMatchObject({ status_code: null, content_hash: null })
  })

  it('reads at most ~1 MB of the body', async () => {
    const { db, tables } = fakeDb(seed())
    const CHUNK = 64 * 1024
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(ctl) {
        const chunk = new TextEncoder().encode(pulled === 0 ? '<title>Big</title>'.padEnd(CHUNK, ' ') : 'x'.repeat(CHUNK))
        pulled += chunk.byteLength
        ctl.enqueue(chunk)
      },
    })
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200 }))
    await checkLinks(db, fetchImpl as unknown as typeof fetch, DAY1) // would never finish if the whole (endless) body were read
    expect(pulled).toBeLessThanOrEqual(1024 * 1024 + 2 * CHUNK)
    expect(tables.link_checks[0]).toMatchObject({ status_code: 200, content_hash: sha('Big') })
  })
})

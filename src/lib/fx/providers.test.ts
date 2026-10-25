import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangerateHost } from './exchangerate-host'
import { frankfurter } from './frankfurter'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('frankfurter', () => {
  it('asks for USD-based rates of the requested codes and returns them as-is', async () => {
    fetchMock.mockReturnValue(json({ base: 'USD', rates: { AUD: 1.5, THB: 33 } }))
    expect(await frankfurter.fetchUsdRates(['AUD', 'THB'])).toEqual({ AUD: 1.5, THB: 33 })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://api.frankfurter.dev/v1/latest')
    expect(url.searchParams.get('from')).toBe('USD')
    expect(url.searchParams.get('to')).toBe('AUD,THB')
  })

  it('throws on a non-2xx response or a body without rates', async () => {
    fetchMock.mockReturnValueOnce(json({}, 500))
    await expect(frankfurter.fetchUsdRates(['AUD'])).rejects.toThrow(/500/)
    fetchMock.mockReturnValueOnce(json({ message: 'nope' }))
    await expect(frankfurter.fetchUsdRates(['AUD'])).rejects.toThrow(/no rates/)
  })
})

describe('exchangerateHost', () => {
  it('throws without a key and does not call the network', async () => {
    vi.stubEnv('EXCHANGERATE_HOST_KEY', '')
    await expect(exchangerateHost.fetchUsdRates(['AUD'])).rejects.toThrow(/KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps USDXXX quotes to plain codes', async () => {
    vi.stubEnv('EXCHANGERATE_HOST_KEY', 'k')
    fetchMock.mockReturnValue(json({ success: true, quotes: { USDAUD: 1.5, USDTHB: 33, USDXYZ: 9 } }))
    expect(await exchangerateHost.fetchUsdRates(['AUD', 'THB', 'NZD'])).toEqual({ AUD: 1.5, THB: 33 })
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('access_key')).toBe('k')
    expect(url.searchParams.get('source')).toBe('USD')
  })

  it('throws when the API reports failure', async () => {
    vi.stubEnv('EXCHANGERATE_HOST_KEY', 'k')
    fetchMock.mockReturnValue(json({ success: false, error: { code: 101 } }))
    await expect(exchangerateHost.fetchUsdRates(['AUD'])).rejects.toThrow(/no quotes/)
  })
})

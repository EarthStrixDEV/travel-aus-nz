// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import type { History } from '@/lib/fx/history'
import { RateTrend } from './rate-trend'

const HISTORY: History = {
  points: [
    { day: '2026-10-01', close: 20 },
    { day: '2026-10-02', close: 22 },
    { day: '2026-10-03', close: 21 },
  ],
  high: 22,
  low: 20,
  change: 5,
}
const fetchMock = vi.fn()

const view = (initial: History | null = HISTORY, home = 'THB') =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RateTrend home={home} initial={initial} />
    </NextIntlClientProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RateTrend', () => {
  it('renders the prerendered AUD-THB 1M view without fetching, with Now/Change/High/Low as text', () => {
    view()
    expect(fetchMock).not.toHaveBeenCalled()
    const stats = screen.getByText('Now').closest('dl')!
    expect(stats).toHaveTextContent('Now21.00')
    expect(stats).toHaveTextContent('Change+5.00%')
    expect(stats).toHaveTextContent('High22.00')
    expect(stats).toHaveTextContent('Low20.00')
  })

  it('gives the chart a text summary for screen readers', () => {
    view()
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName('AUD to THB over 1 month. Now 21.00, change +5.00%, high 22.00, low 20.00.')
  })

  it('NZD toggle loads that pair once and keeps it', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...HISTORY, change: -1 })))
    view()
    fireEvent.click(screen.getByRole('button', { name: 'NZD' }))
    await waitFor(() => expect(screen.getByText('Change').closest('dl')).toHaveTextContent('−1.00%'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/fx/history?pair=NZD-THB&range=1m')
    fireEvent.click(screen.getByRole('button', { name: 'AUD' }))
    fireEvent.click(screen.getByRole('button', { name: 'NZD' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows an error with retry when history fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    view(null)
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the rate history.")
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(HISTORY)))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Now').closest('dl')).toBeInTheDocument())
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import type { JourneyCard } from '@/lib/content/journeys'
import type { TransportCity } from '@/lib/content/transport'
import { JourneyPlanner } from './journey-planner'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))
vi.mock('@/i18n/navigation', () => ({ Link: (props: ComponentProps<'a'>) => <a {...props} /> }))

const cities: TransportCity[] = [
  { slug: 'sydney', name: 'Sydney', country: 'au', timezone: 'Australia/Sydney' },
  { slug: 'auckland', name: 'Auckland', country: 'nz', timezone: 'Pacific/Auckland' },
]

const fallback: JourneyCard = {
  slug: 'coast-to-coast-by-rail',
  country: 'au',
  title: '10 days, coast to coast by rail',
  line: 'Three nights on the Indian Pacific.',
  from: 'Sydney',
  to: 'Perth',
  days: 10,
  priceFrom: 6480,
  currency: 'AUD',
  modes: ['train'],
  image: null,
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  track.mockReset()
  window.history.pushState({}, '', '/')
})

function setup(url = '/en/transport') {
  window.history.pushState({}, '', url)
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <JourneyPlanner cities={cities} />
    </NextIntlClientProvider>,
  )
}

describe('JourneyPlanner', () => {
  it('503: shows the unavailable banner and the curated fallback journey', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'ROUTING_UNAVAILABLE', message: 'down' }, fallback }), { status: 503 }),
    )
    setup('/en/transport?from=central-station&to=bondi-beach&depart=2026-11-02T09:00')

    expect(await screen.findByText(en.transport.results.unavailable)).toBeInTheDocument()
    expect(screen.getByText(fallback.title)).toBeInTheDocument()
    expect(screen.getByText('From A$6,480')).toBeInTheDocument()

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toMatch(/^\/api\/v1\/routes\/plan\?/)
    const q = new URL(url, 'http://x').searchParams
    expect(q.get('from')).toBe('central-station')
    expect(q.get('to')).toBe('bondi-beach')
    expect(q.get('depart')).toBe('2026-11-02T09:00')
  })

  it('empty "to": shows a field error and sends no request', () => {
    setup()
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '-33.8830,151.2065' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find routes' }))

    const to = screen.getByLabelText('To')
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(to).toHaveAccessibleDescription(en.transport.planner.errors.toRequired)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })
})

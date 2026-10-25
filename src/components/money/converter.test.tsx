// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))

import { Converter } from './converter'

const RATES = { AUD: 1, NZD: 1.127, THB: 21.48, USD: 0.6582 }
const fetchMock = vi.fn()

function view(props: Partial<React.ComponentProps<typeof Converter>> = {}) {
  const onHome = vi.fn()
  const onRetry = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Converter home="THB" onHome={onHome} rates={RATES} status="ready" banner={null} rateLine="1 AUD = 21.48 THB" onRetry={onRetry} {...props} />
    </NextIntlClientProvider>,
  )
  return { onHome, onRetry }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Converter', () => {
  it('converts the default 10,000 THB to AUD and NZD from the shipped snapshot', () => {
    view()
    expect(screen.getByText('465.55')).toBeInTheDocument() // 10000 / 21.48
    expect(screen.getByText('524.67')).toBeInTheDocument() // x 1.127
  })

  it('typing recomputes with no network request', () => {
    view()
    fireEvent.change(screen.getByLabelText('Amount you have'), { target: { value: '21,480' } })
    expect(screen.getByText('1,000.00')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swap converts AUD into the home currency', () => {
    view()
    fireEvent.change(screen.getByLabelText('Amount you have'), { target: { value: '100' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Swap currencies' })[0])
    expect(screen.getByText('2,148.00')).toBeInTheDocument() // 100 AUD -> THB
    expect(screen.getByText('112.70')).toBeInTheDocument() // 100 AUD -> NZD
  })

  it('tracks fx_convert once, debounced, with currencies and no amount', () => {
    view()
    expect(track).not.toHaveBeenCalled() // nothing on mount
    const input = screen.getByLabelText('Amount you have')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.change(input, { target: { value: '55' } })
    fireEvent.change(input, { target: { value: '555' } })
    expect(track).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('fx_convert', { from: 'THB', to: 'AUD+NZD' })
    expect(JSON.stringify(track.mock.calls)).not.toContain('555')
  })

  it('shows the retry affordance when no rates are saved', () => {
    const { onRetry } = view({ rates: null, status: 'error', rateLine: null })
    expect(screen.getByText(/Rates unavailable/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('stale banner keeps the last saved rates usable', () => {
    view({ banner: { title: "We couldn't load today's rates.", text: 'Prices use the last saved rates from 14 Oct 2026.' } })
    expect(screen.getByRole('alert')).toHaveTextContent('last saved rates from 14 Oct 2026')
    expect(screen.getByText('465.55')).toBeInTheDocument()
  })

  it('loading hides results behind a skeleton', () => {
    view({ status: 'loading' })
    expect(screen.getByLabelText('Loading rates')).toBeInTheDocument()
    expect(screen.queryByText('465.55')).not.toBeInTheDocument()
  })
})

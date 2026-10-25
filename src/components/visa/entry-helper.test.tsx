// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { entryFixture } from './test-fixtures'

const track = vi.hoisted(() => vi.fn())
vi.mock('@/lib/analytics/track', () => ({ track }))

import { EntryHelper } from './entry-helper'

const fetchMock = vi.fn()
const DISCLAIMER = 'Indicative, confirm on the official site'

function view(country: 'au' | 'nz' | 'both' = 'both') {
  const data = entryFixture()
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EntryHelper rules={data.rules} permissions={data.permissions} links={data.links} country={country} />
    </NextIntlClientProvider>,
  )
}

const runButton = () => screen.getAllByRole('button', { name: 'Show what I may need' })[0]
function run() {
  fireEvent.click(runButton())
  act(() => {
    vi.advanceTimersByTime(1500)
  })
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

describe('EntryHelper', () => {
  it('starts empty, with the privacy line, Thailand preselected and tourism / up to 1 month chosen', () => {
    view()
    expect(screen.getByText('Your result will appear here.')).toBeInTheDocument()
    expect(screen.getByText('Nothing you enter here is stored or sent.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Passport nationality' })).toHaveValue('Thailand')
    expect(screen.getByRole('button', { name: 'Tourism' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Up to 1 month' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a loading state, then the verified permission for Australia and the official site for the stale NZ rule', () => {
    view()
    fireEvent.click(runButton())
    expect(screen.getByLabelText('Checking')).toHaveAttribute('aria-busy', 'true')
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    const au = screen.getByRole('article', { name: 'Australia' })
    expect(within(au).getByRole('heading', { name: 'Electronic Travel Authority (ETA)' })).toBeInTheDocument()
    expect(within(au).getByText('Electronic Travel Authority (ETA) explained')).toBeInTheDocument()

    // NZ rule verified 45 days ago: the permission name must not be shown, only the official link.
    const nz = screen.getByRole('article', { name: 'New Zealand' })
    expect(within(nz).queryByText('NZeTA')).not.toBeInTheDocument()
    expect(within(nz).getByRole('heading', { name: 'Check the official site' })).toBeInTheDocument()
    expect(within(nz).getByRole('link', { name: /Immigration New Zealand/ })).toHaveAttribute('href', 'https://www.immigration.govt.nz')
  })

  it('every result opens the official site in a new tab and ends with the indicative disclaimer', () => {
    view()
    run()
    for (const name of ['Australia', 'New Zealand']) {
      const card = screen.getByRole('article', { name })
      const link = within(card).getByRole('link', { name: /^Open/ })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(card.lastElementChild).toHaveTextContent(DISCLAIMER)
    }
  })

  it('the country tab limits the result to one country', () => {
    view('au')
    run()
    expect(screen.getByRole('article', { name: 'Australia' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'New Zealand' })).not.toBeInTheDocument()
  })

  it('makes no network request, and the only analytics event is the CTA click with the country alone', () => {
    view()
    fireEvent.change(screen.getByRole('combobox', { name: 'Passport nationality' }), { target: { value: 'Jap' } })
    fireEvent.click(screen.getByRole('option', { name: 'Japan' }))
    fireEvent.click(screen.getByRole('button', { name: '1 to 3 months' }))
    run()
    expect(track).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('article', { name: 'Australia' })).getByRole('link', { name: /^Open/ }))
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('visa_official_click', { country: 'AU' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('"Not listed here" gives the not-listed answer with an official link', () => {
    view('au')
    fireEvent.focus(screen.getByRole('combobox', { name: 'Passport nationality' }))
    fireEvent.click(screen.getByRole('option', { name: 'Not listed here' }))
    run()
    const au = screen.getByRole('article', { name: 'Australia' })
    expect(within(au).getByRole('heading', { name: "Your nationality isn't in our guide" })).toBeInTheDocument()
    expect(within(au).getByRole('link', { name: /^Open/ })).toHaveAttribute('href', 'https://immi.homeaffairs.gov.au')
    expect(au.lastElementChild).toHaveTextContent(DISCLAIMER)
  })

  it('work or study gives no permission, only the explanation and the official link', () => {
    view('au')
    fireEvent.click(screen.getByRole('button', { name: 'Work or study' }))
    run()
    const au = screen.getByRole('article', { name: 'Australia' })
    expect(within(au).getByRole('heading', { name: 'Work and study use a different permission' })).toBeInTheDocument()
    expect(within(au).queryByText('Electronic Travel Authority (ETA)')).not.toBeInTheDocument()
  })

  it('a nationality that is not chosen asks for one instead of guessing', () => {
    view()
    const input = screen.getByRole('combobox', { name: 'Passport nationality' })
    fireEvent.change(input, { target: { value: 'zzz' } })
    fireEvent.click(runButton())
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a nationality')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('keyboard: arrows move through the options, Enter picks, Escape closes', () => {
    view()
    const input = screen.getByRole('combobox', { name: 'Passport nationality' })
    fireEvent.change(input, { target: { value: 'J' } })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('Japan')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('mobile steps: Next walks 1 to 3, Back returns, and the last step runs the helper', () => {
    view()
    expect(screen.getByLabelText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByLabelText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByLabelText('Step 3 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Step 2 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Show what I may need' }).at(-1)!)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('article', { name: 'Australia' })).toBeInTheDocument()
  })
})

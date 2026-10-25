// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import type { VenueCard } from '@/lib/venues/filter'
import { VenueBrowser } from './venue-browser'

const state = vi.hoisted(() => ({ search: '', replace: vi.fn(), toggle: vi.fn(), saved: new Set<string>() }))

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/eat-drink',
  useRouter: () => ({ replace: state.replace }),
  Link: ({ href, ...props }: Omit<ComponentProps<'a'>, 'href'> & { href: string | { pathname: string; query: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`} {...props} />
  ),
}))
vi.mock('@/components/trip/use-saved-places', () => ({ useSavedPlaces: () => ({ saved: state.saved, toggle: state.toggle }) }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
beforeEach(() => {
  state.search = ''
  state.saved = new Set()
  vi.clearAllMocks()
})
afterEach(cleanup)

function venue(slug: string, over: Partial<VenueCard> = {}): VenueCard {
  return {
    id: `id-${slug}`,
    slug,
    kind: 'restaurant',
    name: slug.toUpperCase(),
    city: { slug: 'sydney', name: 'Sydney' },
    hood: 'Surry Hills',
    cuisine: { slug: 'seafood', name: 'Seafood' },
    priceLevel: 3,
    dietary: [],
    drinks: [],
    tags: [],
    description: `About ${slug}`,
    menuHighlights: `Menu of ${slug}`,
    signatureDrinks: '',
    hours: [{ weekday: 2, open: '17:30', close: '23:00' }, { weekday: 3, open: '17:30', close: '23:00' }, { weekday: 4, open: '17:30', close: '23:00' }],
    hoursNote: '',
    stop: { name: 'Central Station', walkMin: 11 },
    ...over,
  }
}

const VENUES = [
  venue('saltbush', { dietary: ['vegetarian'], cuisine: { slug: 'modern-australian', name: 'Modern Australian' } }),
  venue('harbourline', { dietary: ['gluten_free'] }),
  venue('hollow', { kind: 'bar', cuisine: null, tags: [{ slug: 'hidden', name: 'Hidden' }], drinks: ['cocktails'], priceLevel: 2 }),
]

const view = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VenueBrowser venues={VENUES} />
    </NextIntlClientProvider>,
  )

describe('VenueBrowser', () => {
  it('shows the restaurants tab by default with counts', () => {
    view()
    expect(screen.getByRole('tab', { name: /Restaurants/, selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Bars/ })).toHaveTextContent('1')
    expect(screen.getByText('2 restaurants')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show details for SALTBUSH' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show details for HOLLOW' })).not.toBeInTheDocument()
  })

  it('reads the tab and filters from the URL', () => {
    state.search = 'kind=bar'
    view()
    expect(screen.getByText('1 bar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show details for HOLLOW' })).toBeInTheDocument()

    cleanup()
    state.search = 'diet=vegetarian'
    view()
    expect(screen.getByText('1 restaurant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show details for SALTBUSH' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show details for HARBOURLINE' })).not.toBeInTheDocument()
  })

  it('writes filter changes to the URL without scrolling', () => {
    view()
    fireEvent.click(screen.getByRole('button', { name: /Vegetarian/ }))
    expect(state.replace).toHaveBeenCalledWith('/eat-drink?diet=vegetarian', { scroll: false })

    fireEvent.click(screen.getByRole('tab', { name: /Bars/ }))
    expect(state.replace).toHaveBeenLastCalledWith('/eat-drink?kind=bar', { scroll: false })
  })

  it('shows facet counts and disables chips with no matches', () => {
    state.search = 'diet=vegetarian'
    view()
    // Vegetarian is selected: the diet facet ignores it, so gluten-free still counts its own venue.
    expect(screen.getByRole('button', { name: /Gluten-free/ })).toBeEnabled()
    cleanup()
    state.search = 'cuisine=modern-australian'
    view()
    expect(screen.getByRole('button', { name: /Gluten-free/ })).toBeDisabled()
  })

  it('shows the empty state with Clear filters when nothing matches', () => {
    state.search = 'diet=vegetarian&diet=gluten_free'
    view()
    expect(screen.getByText('Nothing matches these filters')).toBeInTheDocument()
    expect(screen.getByText('0 restaurants')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(state.replace).toHaveBeenCalledWith('/eat-drink', { scroll: false })
  })

  it('opens the drawer with details, closes it, and returns focus to the card', () => {
    view()
    const trigger = screen.getByRole('button', { name: 'Show details for SALTBUSH' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'SALTBUSH' })
    expect(within(dialog).getByText('Menu of saltbush')).toBeInTheDocument()
    expect(within(dialog).getByText('Tue–Thu 17:30–23:00')).toBeInTheDocument()
    expect(within(dialog).getByText('Central Station')).toBeInTheDocument()
    expect(within(dialog).getByText('11 min walk')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'On the map' })).toHaveAttribute('href', '/map?place=saltbush')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('Save toggles the shared saved state from the card and from the drawer', () => {
    state.saved = new Set(['id-saltbush'])
    view()
    expect(screen.getByRole('button', { name: 'Remove SALTBUSH from saved' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Save HARBOURLINE' }))
    expect(state.toggle).toHaveBeenCalledWith('id-harbourline')

    fireEvent.click(screen.getByRole('button', { name: 'Show details for SALTBUSH' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Saved to my trip' }))
    expect(state.toggle).toHaveBeenLastCalledWith('id-saltbush')
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { photo } from '@/lib/gallery/fixtures'
import { GalleryBrowser } from './gallery-browser'

const state = vi.hoisted(() => ({ search: '', replace: vi.fn(), toggle: vi.fn(), saved: new Set<string>() }))

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/gallery',
  useRouter: () => ({ replace: state.replace }),
  Link: ({ href, ...props }: Omit<ComponentProps<'a'>, 'href'> & { href: string | { pathname: string; query: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`} {...props} />
  ),
}))
vi.mock('@/components/trip/use-saved-places', () => ({ useSavedPlaces: () => ({ saved: state.saved, toggle: state.toggle }) }))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- stands in for next/image in jsdom
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => <img src={src} alt={alt} className={className} />,
}))

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

const PHOTOS = [
  photo('bondi', { title: 'Bondi walk', sort: 1, season: 'summer', type: 'beach', typeLabel: 'Beach', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('opera', { title: 'Opera House', sort: 2, season: 'winter', type: 'heritage', typeLabel: 'Heritage', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('hosier', { title: 'Hosier Lane', sort: 3, season: 'winter', type: 'city', typeLabel: 'City', region: { slug: 'sydney', name: 'Sydney' } }),
  photo('cradle', { title: 'Cradle Mountain', sort: 4, season: 'winter', type: 'mountain', typeLabel: 'Mountain', region: { slug: 'tasmania', name: 'Tasmania' } }),
]

const view = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <GalleryBrowser photos={PHOTOS} />
    </NextIntlClientProvider>,
  )

const tile = (title: string) => screen.getByRole('button', { name: `Open ${title}` })

describe('GalleryBrowser', () => {
  it('shows every photo with the count, and the tile caption (title · type · region · season)', () => {
    view()
    expect(screen.getByText('4 photographs')).toBeInTheDocument()
    expect(tile('Bondi walk')).toHaveTextContent('Beach')
    expect(tile('Bondi walk')).toHaveTextContent('Sydney · Summer')
  })

  it('each filter group starts on All / Any', () => {
    view()
    expect(within(screen.getByRole('group', { name: 'Region' })).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: 'Type' })).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: 'Season' })).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reads the filters from the URL: winter + sydney is an intersection', () => {
    state.search = 'season=winter&region=sydney'
    view()
    expect(screen.getByText('2 photographs')).toBeInTheDocument()
    expect(tile('Opera House')).toBeInTheDocument()
    expect(tile('Hosier Lane')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Bondi walk' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Cradle Mountain' })).not.toBeInTheDocument()
  })

  it('writes a chip click to the URL without scrolling; All clears just that group', () => {
    view()
    fireEvent.click(within(screen.getByRole('group', { name: 'Season' })).getByRole('button', { name: 'Winter' }))
    expect(state.replace).toHaveBeenLastCalledWith('/gallery?season=winter', { scroll: false })

    cleanup()
    state.search = 'season=winter&region=tasmania'
    view()
    fireEvent.click(within(screen.getByRole('group', { name: 'Region' })).getByRole('button', { name: 'All' }))
    expect(state.replace).toHaveBeenLastCalledWith('/gallery?season=winter', { scroll: false })
  })

  it('no match: "Nothing matches every filter" and Clear filters resets the URL', () => {
    state.search = 'season=summer&region=tasmania'
    view()
    expect(screen.getByText('Nothing matches every filter')).toBeInTheDocument()
    expect(screen.getByText('0 photographs')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Open / })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(state.replace).toHaveBeenCalledWith('/gallery', { scroll: false })
  })

  it('opens the lightbox over the filtered list, steps with Next, and returns focus to the tile on close', () => {
    state.search = 'season=winter'
    view()
    const trigger = tile('Opera House')
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Opera House' })
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Previous photo' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }))
    expect(screen.getByRole('dialog', { name: 'Cradle Mountain' })).toBeInTheDocument()
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Next photo' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('arrow keys step through the lightbox', () => {
    view()
    fireEvent.click(tile('Bondi walk'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByRole('dialog', { name: 'Opera House' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(screen.getByRole('dialog', { name: 'Bondi walk' })).toBeInTheDocument()
  })

  it('Add to trip saves the place of the shown photo (login gate lives in the hook)', () => {
    view()
    fireEvent.click(tile('Hosier Lane'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add to trip' }))
    expect(state.toggle).toHaveBeenCalledWith('place-hosier')
  })

  it('a photo whose image file is missing still renders its tile (placeholder block)', () => {
    view()
    const img = tile('Bondi walk').querySelector('img')!
    fireEvent.error(img)
    expect(tile('Bondi walk')).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { photo } from '@/lib/gallery/fixtures'
import { Lightbox } from './lightbox'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: Omit<ComponentProps<'a'>, 'href'> & { href: string | { pathname: string; query: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.query)}`} {...props} />
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- stands in for next/image in jsdom
  default: ({ src, alt, className, onError }: { src: string; alt: string; className?: string; onError?: () => void }) => <img src={src} alt={alt} className={className} onError={onError} />,
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

const onIndex = vi.fn()
const onClose = vi.fn()
const onToggleSave = vi.fn()
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const PHOTOS = [
  photo('bondi', { title: 'Bondi walk', type: 'beach', typeLabel: 'Beach' }),
  photo('opera', {
    title: 'Opera House',
    type: 'heritage',
    typeLabel: 'Heritage',
    place: {
      nearby: [
        { slug: 'oyster', name: 'Harbourline Oyster Room', area: 'The Rocks' },
        { slug: 'trattoria', name: 'Wharf Street Trattoria', area: 'Woolloomooloo' },
      ],
    },
  }),
  photo('hosier', { title: 'Hosier Lane', type: 'city', typeLabel: 'City' }),
]

const view = (index: number | null, saved = false) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Lightbox photos={PHOTOS} index={index} saved={saved} onIndex={onIndex} onClose={onClose} onToggleSave={onToggleSave} />
    </NextIntlClientProvider>,
  )

describe('Lightbox', () => {
  it('renders nothing while closed', () => {
    view(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('at the last photo of the filtered list: "3 / 3" and Next is disabled (no wrap)', () => {
    view(2)
    const dialog = screen.getByRole('dialog', { name: 'Hosier Lane' })
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Next photo' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Previous photo' })).toBeEnabled()
  })

  it('at the first photo: "1 / 3" and Previous is disabled', () => {
    view(0)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeEnabled()
  })

  it('Prev / Next buttons ask for the neighbouring index', () => {
    view(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(onIndex).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(onIndex).toHaveBeenLastCalledWith(0)
  })

  it('arrow keys move, but never past either end', () => {
    view(1)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(onIndex).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(onIndex).toHaveBeenLastCalledWith(0)

    cleanup()
    onIndex.mockClear()
    view(2)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(onIndex).not.toHaveBeenCalled()

    cleanup()
    view(0)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(onIndex).not.toHaveBeenCalled()
  })

  it('shows the place summary: best time, how to get there, nearby dining', () => {
    view(1)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Best opera')).toBeInTheDocument()
    expect(within(dialog).getByText('Access opera')).toBeInTheDocument()
    expect(within(dialog).getByText('Harbourline Oyster Room')).toBeInTheDocument()
    expect(within(dialog).getByText('Wharf Street Trattoria')).toBeInTheDocument()
    expect(within(dialog).getByText('About opera')).toBeInTheDocument()
  })

  it('says so when a place has no nearby dining', () => {
    view(0)
    expect(screen.getByText('No venues listed nearby')).toBeInTheDocument()
  })

  it('"Open attraction page" goes to the map drawer for that place', () => {
    view(1)
    expect(screen.getByRole('link', { name: 'Open attraction page' })).toHaveAttribute('href', '/map?place=opera')
  })

  it('"Add to trip" toggles the saved state for the shown place', () => {
    view(1)
    fireEvent.click(screen.getByRole('button', { name: 'Add to trip' }))
    expect(onToggleSave).toHaveBeenCalledTimes(1)
  })

  it('reflects an already saved place', () => {
    view(1, true)
    expect(screen.getByRole('button', { name: 'In your trip' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a failed image does not leak into the next photo', () => {
    const ui = (index: number) => (
      <NextIntlClientProvider locale="en" messages={en}>
        <Lightbox photos={PHOTOS} index={index} saved={false} onIndex={onIndex} onClose={onClose} onToggleSave={onToggleSave} />
      </NextIntlClientProvider>
    )
    const { rerender } = render(ui(0))
    fireEvent.error(screen.getByRole('img', { name: 'Alt bondi' }))
    expect(screen.queryByRole('img', { name: 'Alt bondi' })).not.toBeInTheDocument()

    rerender(ui(1))
    expect(screen.getByRole('img', { name: 'Alt opera' })).toBeInTheDocument()
  })

  it('closing (Close button, or the native Esc / backdrop close) reports onClose', () => {
    view(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from 'next-intl'
import en from '../../../messages/en.json'
import { photo } from '@/lib/gallery/fixtures'
import { GalleryFallback } from './gallery-fallback'
import type { T } from './labels'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...p }: Omit<ComponentProps<'a'>, 'href'> & { href: { pathname: string; query: Record<string, string> } }) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`} {...p} />
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- stands in for next/image in jsdom
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

// The same translator next-intl hands the page (real ICU plural for the count).
const t = createTranslator({ locale: 'en', messages: en, namespace: 'gallery' }) as unknown as T

describe('GalleryFallback (server-rendered default view)', () => {
  it('puts photo titles, captions and map links in the HTML', () => {
    const html = renderToStaticMarkup(
      <GalleryFallback
        photos={[photo('bondi', { title: 'Bondi to Coogee coastal walk' }), photo('opera', { title: 'Sydney Opera House', type: 'heritage', typeLabel: 'Heritage', season: 'spring' })]}
        t={t}
      />,
    )
    expect(html).toContain('Bondi to Coogee coastal walk')
    expect(html).toContain('Sydney Opera House')
    expect(html).toContain('Heritage')
    expect(html).toContain('Sydney · Spring')
    expect(html).toContain('href="/map?place=bondi"')
    expect(html).toContain('2 photographs')
  })

  it('renders a photo whose blurhash and file are missing (no blur placeholder, no crash)', () => {
    const html = renderToStaticMarkup(<GalleryFallback photos={[photo('x', { title: 'No blur', image: { blurDataURL: undefined } })]} t={t} />)
    expect(html).toContain('No blur')
  })
})

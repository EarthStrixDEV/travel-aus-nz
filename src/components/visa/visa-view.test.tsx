import type { ComponentProps } from 'react'
import { renderToString } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../messages/en.json'
import th from '../../../messages/th.json'
import { entryFixture } from './test-fixtures'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...p }: ComponentProps<'a'>) => <a href={href} {...p} />,
}))
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }))

import { VisaView } from './visa-view'

const html = (props: Partial<ComponentProps<typeof VisaView>> = {}, locale: 'en' | 'th' = 'en') =>
  renderToString(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : th}>
      <VisaView data={entryFixture()} failed={false} {...props} />
    </NextIntlClientProvider>,
  )

describe('VisaView (the prerendered default view)', () => {
  it('ships every default section in the HTML, without running any effect', () => {
    const out = html()
    for (const s of [
      'Australia', 'New Zealand', 'Both', // country tabs
      'Entry rules change.',
      'Your result will appear here.', // empty helper
      'Permission types', 'Electronic Travel Authority (ETA)', 'NZeTA', // permission types
      'Six calm steps', 'Check requirements', 'Recommended lead time', // timeline (bundled copy: content block is empty)
      'Passport validity', '0 of 2 ready', // documents
      'Apply only on official government sites or apps.', // scams
      'Go straight to the source', 'Department of Home Affairs', // official sources
      'Can I work or study on this?', 'Visitor permissions are generally for tourism.', // FAQ question and answer
      'Keep planning',
    ]) {
      expect(out, s).toContain(s)
    }
  })

  it('marks permission fields with no verified_at as Placeholder, and verified ones not', () => {
    const out = html()
    // fixture: au-eta verified, nzeta not -> exactly the 3 value fields of nzeta (processing, fee, validity)
    expect(out.match(/data-placeholder/g)).toHaveLength(3 + 1) // + the lead-time block (content block unverified)
  })

  it('offers "Report outdated info" per permission', () => {
    expect(html().match(/Report outdated info/g)).toHaveLength(2)
  })

  it('renders the Thai page', () => {
    expect(html({}, 'th')).toContain(th.visa.banner.title)
  })

  it('with a failed load and empty data it still renders, with a notice and the official sites', () => {
    const out = html({ failed: true, data: { rules: [], permissions: [], links: [], documents: [], faqs: [], timeline: null, last_verified_at: null } })
    expect(out).toContain("couldn&#x27;t load the latest details")
    expect(out).toContain('https://immi.homeaffairs.gov.au')
    expect(out).toContain('https://www.immigration.govt.nz')
    expect(out).toContain('Six calm steps')
    expect(out).toContain('Apply only on official government sites or apps.')
  })
})

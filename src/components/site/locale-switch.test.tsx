// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { LocaleSwitch } from './locale-switch'

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/map',
  Link: ({ locale, href, ...props }: ComponentProps<'a'> & { locale: string }) => (
    <a href={`/${locale}${href}`} {...props} />
  ),
}))

afterEach(cleanup)

describe('LocaleSwitch', () => {
  it('accessible name contains the visible code (WCAG 2.5.3) and the language name', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LocaleSwitch />
      </NextIntlClientProvider>,
    )
    const th = screen.getByRole('link', { name: /^TH\b/ })
    expect(th).toHaveAccessibleName(expect.stringContaining('ภาษาไทย'))
    expect(th).not.toHaveAttribute('aria-label')
    expect(th).toHaveAttribute('href', '/th/map')

    const current = screen.getByRole('link', { name: /^EN\b/ })
    expect(current).toHaveAccessibleName(expect.stringContaining('English'))
    expect(current).toHaveAttribute('aria-current', 'true')
  })
})

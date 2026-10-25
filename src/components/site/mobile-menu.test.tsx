// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { MobileMenu } from './mobile-menu'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => nav.pathname,
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}))
vi.mock('./gated-link', () => ({ GatedLink: (props: ComponentProps<'a'>) => <a {...props} /> }))
vi.mock('./account-menu', () => ({ AccountMenu: () => <span>Sign in</span> }))
vi.mock('./locale-switch', () => ({ LocaleSwitch: () => null }))
vi.mock('./theme-toggle', () => ({ ThemeToggle: () => null }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(() => {
  cleanup()
  nav.pathname = '/'
})

const view = () => (
  <NextIntlClientProvider locale="en" messages={en}>
    <MobileMenu />
  </NextIntlClientProvider>
)

describe('MobileMenu', () => {
  it('closes when the route changes (nav links, inline Sign in)', () => {
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    nav.pathname = '/login'
    rerender(view())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open while the route is unchanged', () => {
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    rerender(view())
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { AccountMenu } from './account-menu'

const route = vi.hoisted(() => ({ locale: '/map' }))
const auth = vi.hoisted(() => ({
  value: { user: null as { id: string; email: string } | null, ready: true },
}))
const maybeSingle = vi.hoisted(() => vi.fn())

vi.mock('@/components/auth/auth-provider', () => ({ useAuth: () => auth.value }))
vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/th/map',
  useSearchParams: () => new URLSearchParams('x=1'),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
  usePathname: () => route.locale,
}))

afterEach(() => {
  cleanup()
  auth.value = { user: null, ready: true }
  maybeSingle.mockReset()
  route.locale = '/map'
})

const renderMenu = (props: ComponentProps<typeof AccountMenu> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AccountMenu {...props} />
    </NextIntlClientProvider>,
  )

const signedIn = (role: 'user' | 'editor' | 'admin') => {
  auth.value = { user: { id: 'u1', email: 'earth@example.com' }, ready: true }
  maybeSingle.mockResolvedValue({ data: { role } })
}

describe('AccountMenu', () => {
  it('not ready: renders an empty placeholder, no Sign in', () => {
    auth.value = { user: null, ready: false }
    const { container } = renderMenu()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('guest on the login page: no Sign in link (would nest next)', () => {
    route.locale = '/login'
    renderMenu()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('guest: Sign in link carrying next', () => {
    renderMenu()
    const link = screen.getByRole('link', { name: 'Sign in' })
    expect(link.getAttribute('href')).toBe('/login?next=%2Fth%2Fmap%3Fx%3D1')
  })

  it('signed in as user: sign-out POST form, no Admin link', async () => {
    signedIn('user')
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('earth@example.com')).toBeInTheDocument()
    const signOut = screen.getByRole('button', { name: 'Sign out' })
    const form = signOut.closest('form')!
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/auth/sign-out')
    // Flush the role query so the absence below is checked after it resolved.
    await act(async () => {
      await maybeSingle.mock.results[0].value
    })
    expect(maybeSingle).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('signed in as editor: Admin link present', async () => {
    signedIn('editor')
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    const admin = await screen.findByRole('link', { name: 'Admin' })
    expect(admin).toHaveAttribute('href', '/admin')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    signedIn('user')
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Sign out' }), { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on outside pointer down', () => {
    signedIn('user')
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('inline: lists the account items without a disclosure', async () => {
    signedIn('admin')
    renderMenu({ inline: true })
    expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' }).closest('form')).toHaveAttribute('action', '/auth/sign-out')
    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { LoginRequiredDialogProvider } from './login-required-dialog'
import { useRequireLogin } from './use-require-login'

const auth = vi.hoisted(() => ({ value: { user: null as { id: string } | null, ready: true } }))
const nav = vi.hoisted(() => ({ pathname: '/th/map' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('./auth-provider', () => ({ useAuth: () => auth.value }))
vi.mock('@/i18n/navigation', () => ({
  Link: (props: ComponentProps<'a'>) => <a {...props} />,
}))

// jsdom has no modal <dialog> behaviour; model open/close/close-event.
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
  auth.value = { user: null, ready: true }
  window.history.pushState({}, '', '/')
  nav.pathname = '/th/map'
})

function Probe({ action }: { action: () => void }) {
  const requireLogin = useRequireLogin()
  return <button onClick={() => requireLogin(action)}>go</button>
}

function setup(action: () => void) {
  window.history.pushState({}, '', '/th/map?x=1')
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LoginRequiredDialogProvider>
        <Probe action={action} />
      </LoginRequiredDialogProvider>
    </NextIntlClientProvider>,
  )
  return screen.getByRole('button', { name: 'go' })
}

describe('useRequireLogin', () => {
  it('guest: never runs the action, opens the dialog with a Sign-in link carrying next', () => {
    const action = vi.fn()
    fireEvent.click(setup(action))
    expect(action).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: en.gate.title })
    expect(dialog).toHaveTextContent(en.gate.body)
    const signIn = screen.getByRole('link', { name: 'Sign in' })
    expect(signIn.getAttribute('href')).toContain('next=%2Fth%2Fmap%3Fx%3D1')
    expect(signIn.getAttribute('href')).toMatch(/^\/login\?/)
  })

  it('"Not now" closes the dialog and focus returns to the trigger', () => {
    const trigger = setup(vi.fn())
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('signed in: runs the action once, no dialog', () => {
    auth.value = { user: { id: 'u1' }, ready: true }
    const action = vi.fn()
    fireEvent.click(setup(action))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('not ready: does nothing', () => {
    auth.value = { user: null, ready: false }
    const action = vi.fn()
    fireEvent.click(setup(action))
    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the open dialog when the route changes (e.g. after following Sign in)', () => {
    const view = () => (
      <NextIntlClientProvider locale="en" messages={en}>
        <LoginRequiredDialogProvider>
          <Probe action={vi.fn()} />
        </LoginRequiredDialogProvider>
      </NextIntlClientProvider>
    )
    window.history.pushState({}, '', '/th/map?x=1')
    const { rerender } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    nav.pathname = '/th/login'
    rerender(view())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

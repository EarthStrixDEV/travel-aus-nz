// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../../../messages/en.json'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}))

import { LoginForm } from './login-form'

const renderForm = (next = '/th/admin') =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LoginForm next={next} />
    </NextIntlClientProvider>,
  )

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('LoginForm', () => {
  it('unknown error code falls back to the generic message, never the raw text', async () => {
    signInWithOtp.mockResolvedValue({ error: { code: 'weird', message: 'RAW BACKEND TEXT' } })
    renderForm()
    await userEvent.setup().type(screen.getByLabelText('Email'), 'a@b.co{Enter}')
    expect(await screen.findByText(en.auth.sendFailed)).toBeInTheDocument()
    expect(screen.queryByText('RAW BACKEND TEXT')).not.toBeInTheDocument()
  })

  it('sends a magic link with an encoded callback redirect, then shows the check-email text', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    renderForm('/th/admin?tab=2')
    await userEvent.setup().type(screen.getByLabelText('Email'), 'a@b.co{Enter}')
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled())
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/th/admin?tab=2')}`,
      },
    })
    expect(await screen.findByText(/sent a sign-in link to a@b\.co/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('send failure surfaces on the email field and keeps the form', async () => {
    signInWithOtp.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' } })
    renderForm()
    await userEvent.setup().type(screen.getByLabelText('Email'), 'a@b.co{Enter}')
    expect(await screen.findByText(en.auth.rateLimited)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(en.auth.rateLimited)
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled()
  })

  it('disables the submit button while pending', async () => {
    let resolve!: (v: unknown) => void
    signInWithOtp.mockReturnValue(new Promise((r) => (resolve = r)))
    renderForm()
    await userEvent.setup().type(screen.getByLabelText('Email'), 'a@b.co{Enter}')
    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
    resolve({ error: null })
    await screen.findByText(/sent a sign-in link/)
  })

  it('OAuth buttons call signInWithOAuth with the callback redirect', async () => {
    signInWithOAuth.mockResolvedValue({ error: null })
    renderForm()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/th/admin')}`,
      },
    })
  })

  it('OAuth error is shown and buttons re-enable', async () => {
    signInWithOAuth.mockResolvedValue({ error: { code: 'provider_disabled', message: 'Unsupported provider: provider is not enabled' } })
    renderForm()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue with Apple' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.providerDisabled)
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeEnabled()
  })
})

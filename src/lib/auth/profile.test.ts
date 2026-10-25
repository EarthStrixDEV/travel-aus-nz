import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const single = vi.fn()
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: single }) }) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('next-intl/server', () => ({ getLocale: async () => 'th' }))
const headerGet = vi.fn()
vi.mock('next/headers', () => ({ headers: async () => ({ get: headerGet }) }))

import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { getCurrentProfile, requireRole, requireUser } from './profile'

const profile = (role: 'user' | 'editor' | 'admin') => ({
  id: 'u1',
  role,
  locale: 'th',
  display_name: null,
  home_currency: 'THB',
  created_at: '2026-01-01',
})

beforeEach(() => {
  vi.clearAllMocks()
  headerGet.mockReturnValue(null)
})

describe('getCurrentProfile', () => {
  it('returns null without a user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await getCurrentProfile()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })
  it('returns the profile row for the user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    single.mockResolvedValue({ data: profile('user') })
    expect(await getCurrentProfile()).toEqual(profile('user'))
  })
})

describe('requireUser', () => {
  it('no user -> redirects to locale login with next', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    headerGet.mockReturnValue('/th/prepare')
    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/login', query: { next: '/th/prepare' } },
      locale: 'th',
    })
  })
  it('hostile pathname header is sanitised', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    headerGet.mockReturnValue('//evil.com')
    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/login', query: { next: '/th' } },
      locale: 'th',
    })
  })
  it('with a user -> resolves the user without reading the profile', async () => {
    const user = { id: 'u1' }
    getUser.mockResolvedValue({ data: { user } })
    await expect(requireUser()).resolves.toEqual(user)
    expect(redirect).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

describe('requireRole', () => {
  it('no user -> still redirects (via requireUser) and never reads a profile', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    headerGet.mockReturnValue('/th/admin')
    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_REDIRECT')
    expect(from).not.toHaveBeenCalled()
  })
  it('no user -> redirects to locale login with next', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    headerGet.mockReturnValue('/th/admin')
    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/login', query: { next: '/th/admin' } },
      locale: 'th',
    })
  })
  it('no pathname header -> next falls back to the locale root', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/login', query: { next: '/th' } },
      locale: 'th',
    })
  })
  it('hostile pathname header is sanitised', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    headerGet.mockReturnValue('//evil.com')
    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith({
      href: { pathname: '/login', query: { next: '/th' } },
      locale: 'th',
    })
  })
  it('role not allowed -> notFound', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    single.mockResolvedValue({ data: profile('user') })
    await expect(requireRole(['admin'])).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
  it('allowed role -> resolves to the profile', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    single.mockResolvedValue({ data: profile('editor') })
    await expect(requireRole(['editor', 'admin'])).resolves.toEqual(profile('editor'))
  })
})

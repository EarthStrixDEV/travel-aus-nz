// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en.json'
import { entryFixture } from './test-fixtures'
import { DocumentsChecklist } from './documents-checklist'

const KEY = 'tanz:v1:visa-docs'

function view(country: 'au' | 'nz' | 'both' = 'both') {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DocumentsChecklist documents={entryFixture().documents} country={country} />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DocumentsChecklist', () => {
  it('counts "n of m ready" and stores the ticks on this device only', () => {
    view()
    expect(screen.getByText('0 of 2 ready')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Passport validity/ }))
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Passport validity/ })).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ passport: true })
    fireEvent.click(screen.getByRole('checkbox', { name: /Passport validity/ }))
    expect(screen.getByText('0 of 2 ready')).toBeInTheDocument()
  })

  it('restores saved ticks after mount and ignores corrupt storage', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ passport: true, ivl: true, gone: true }))
    view()
    expect(screen.getByText('2 of 2 ready')).toBeInTheDocument()
    cleanup()
    window.localStorage.setItem(KEY, '{not json')
    view()
    expect(screen.getByText('0 of 2 ready')).toBeInTheDocument()
  })

  it('the country tab filters the list and the count', () => {
    view('au')
    expect(screen.queryByRole('checkbox', { name: /Tourism levy receipt/ })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 1 ready')).toBeInTheDocument()
  })

  it('still works when localStorage throws (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    view()
    fireEvent.click(screen.getByRole('checkbox', { name: /Passport validity/ }))
    expect(screen.getByText('1 of 2 ready')).toBeInTheDocument()
  })

  it('Print calls window.print and survives it throwing', () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    view()
    fireEvent.click(screen.getByRole('button', { name: 'Print or save this checklist' }))
    expect(print).toHaveBeenCalledTimes(1)
    print.mockImplementation(() => {
      throw new Error('blocked')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Print or save this checklist' }))
    vi.unstubAllGlobals()
  })
})

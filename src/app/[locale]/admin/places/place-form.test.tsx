// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../../../messages/en.json'

const { savePlace, push } = vi.hoisted(() => ({ savePlace: vi.fn(), push: vi.fn() }))
vi.mock('./actions', () => ({ savePlace }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { PlaceForm } from './place-form'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function renderForm(type = 'attraction') {
  const onError = vi.fn()
  render(
    <NextIntlClientProvider locale="en" messages={en} onError={onError}>
      <PlaceForm
        id={null}
        values={{ type, city_id: '1', status: 'draft', is_closed: 'false' }}
        checked={{ tags: [], dietary: [], drinks: [] }}
        hours={Array.from({ length: 7 }, () => [])}
        stops={[]}
        options={{ cities: [{ value: '1', label: 'Sydney' }], tags: [], cuisines: [], stops: [{ value: '7', label: 'Circular Quay (#7)' }] }}
        weekdays={weekdays}
      />
    </NextIntlClientProvider>,
  )
  return onError
}

afterEach(cleanup)

describe('PlaceForm', () => {
  it('renders every label from messages (no missing keys) with th + en name fields', () => {
    const onError = renderForm()
    expect(onError).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name (Thai)')).toBeInTheDocument()
    expect(screen.getByLabelText('Name (English)')).toBeInTheDocument()
    expect(screen.getByLabelText('Monday opens (1)')).toHaveAttribute('type', 'time')
  })

  it('shows the venue sub-form only for restaurant / bar / cafe', async () => {
    renderForm('attraction')
    expect(screen.queryByText('Venue details')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'bar')
    expect(screen.getByText('Venue details')).toBeInTheDocument()
    expect(screen.getByLabelText('Booking')).toBeInTheDocument()
  })

  it('shows field errors and the aria-live save error from the action', async () => {
    savePlace.mockResolvedValue({ fieldErrors: { slug: 'Use lowercase letters, numbers and hyphens only.' } })
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Use lowercase letters, numbers and hyphens only.')).toBeInTheDocument())
    expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('posts hours and stop rows as parallel [] columns and returns to the list on success', async () => {
    savePlace.mockResolvedValue({})
    renderForm()
    await userEvent.type(screen.getByLabelText('Monday opens (1)'), '09:00')
    await userEvent.selectOptions(screen.getByLabelText('Stop 1'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/admin/places'))
    const fd: FormData = savePlace.mock.calls[0][1]
    expect(fd.getAll('hour_weekday[]')).toHaveLength(14)
    expect(fd.getAll('hour_open_time[]')[2]).toBe('09:00') // Monday, first slot
    expect(fd.getAll('stop_stop_id[]')).toEqual(['7', '', ''])
  })
})

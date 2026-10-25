// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from './text-field'

afterEach(cleanup)

describe('TextField', () => {
  it('label click focuses the input', async () => {
    render(<TextField label="Email" name="email" type="email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('name', 'email')
    await userEvent.setup().click(screen.getByText('Email'))
    expect(input).toHaveFocus()
  })

  it('error sets aria-invalid and aria-describedby to the error text', () => {
    render(<TextField label="Email" name="email" error="Required" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
    const id = input.getAttribute('aria-describedby')!
    expect(document.getElementById(id)).toHaveTextContent('Required')
  })

  it('no error → no aria-invalid / aria-describedby', () => {
    render(<TextField label="Email" name="email" />)
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })
})

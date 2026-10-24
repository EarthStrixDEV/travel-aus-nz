import { expect, it } from 'vitest'
import { mediaPath } from './path'

it('builds bucket key', () =>
  expect(mediaPath('places', 'abc', 'f00')).toBe('places/abc/f00.webp'))

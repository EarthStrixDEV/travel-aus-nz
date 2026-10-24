import { describe, expect, it } from 'vitest'
import { t } from './t'

describe('t', () => {
  it('returns requested locale', () =>
    expect(t({ th: 'ซิดนีย์', en: 'Sydney' }, 'th')).toBe('ซิดนีย์'))
  it('falls back to en when th missing', () =>
    expect(t({ en: 'Sydney' }, 'th')).toBe('Sydney'))
  it('falls back to en when th is empty string', () =>
    expect(t({ th: '', en: 'Sydney' }, 'th')).toBe('Sydney'))
  it('returns empty string for null/undefined', () => {
    expect(t(null, 'th')).toBe('')
    expect(t(undefined, 'en')).toBe('')
  })
  it('returns empty string when no usable value', () =>
    expect(t({}, 'en')).toBe(''))
})

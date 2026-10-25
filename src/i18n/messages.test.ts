import { describe, expect, it } from 'vitest'
import th from '../../messages/th.json'
import en from '../../messages/en.json'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('messages', () => {
  it('th and en have identical key sets', () => {
    expect(flatten(th).sort()).toEqual(flatten(en).sort())
  })

  it('both contain common.siteName', () => {
    expect(flatten(th)).toContain('common.siteName')
    expect(flatten(en)).toContain('common.siteName')
  })
})

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fieldErrors, formToInput, rows, toI18n } from './form'

describe('formToInput', () => {
  it('trims, drops blanks, collects `[]` keys as arrays and skips files / Next internals', () => {
    const fd = new FormData()
    fd.set('slug', '  bondi ')
    fd.set('name_th', '   ')
    fd.append('tags[]', '1')
    fd.append('tags[]', ' 2 ')
    fd.set('$ACTION_ID_abc', '')
    fd.set('file', new File(['x'], 'x.jpg'))
    expect(formToInput(fd)).toEqual({ slug: 'bondi', tags: ['1', '2'] })
  })
})

describe('rows', () => {
  it('zips prefixed `[]` columns into objects and drops all-blank rows', () => {
    const fd = new FormData()
    for (const [a, b] of [['7', '4'], ['', ''], ['9', '']]) {
      fd.append('stop_stop_id[]', a)
      fd.append('stop_walk_min[]', b)
    }
    expect(rows(fd, 'stop', ['stop_id', 'walk_min'])).toEqual([{ stop_id: '7', walk_min: '4' }, { stop_id: '9' }])
  })
})

describe('toI18n', () => {
  it('builds { th, en } and returns null when both are empty', () => {
    expect(toI18n({ name_th: 'ก', name_en: 'A' }, 'name')).toEqual({ th: 'ก', en: 'A' })
    expect(toI18n({ name_en: 'A' }, 'name')).toEqual({ en: 'A' })
    expect(toI18n({}, 'name')).toBeNull()
  })
})

describe('fieldErrors', () => {
  it('keys by the first path segment, first issue wins, unknown messages become `invalid`', () => {
    const schema = z.object({ slug: z.string().regex(/^[a-z]+$/, 'slug'), n: z.coerce.number().min(5), s: z.string() })
    const r = schema.safeParse({ slug: 'A B', n: '1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error.issues, (k) => k)).toEqual({ slug: 'errors.slug', n: 'errors.invalid', s: 'errors.required' })
  })
})

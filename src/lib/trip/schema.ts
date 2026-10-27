import { z } from 'zod'

/** Request bodies for `/api/v1/me/*` trip routes (spec §13). */

const MAX_DAYS = 60
const date = z.iso.date('Use a date such as 2026-11-02')
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time such as 09:30')

export const newTripSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(80, 'Title is too long'),
    start_date: date.optional(),
    end_date: date.optional(),
  })
  .refine((t) => !t.start_date === !t.end_date, { message: 'Give both dates or neither', path: ['end_date'] })
  .refine((t) => !t.start_date || !t.end_date || t.end_date >= t.start_date, { message: 'The trip ends before it starts', path: ['end_date'] })
  .refine(
    (t) => !t.start_date || !t.end_date || (Date.parse(t.end_date) - Date.parse(t.start_date)) / 86_400_000 < MAX_DAYS,
    { message: `A trip is at most ${MAX_DAYS} days`, path: ['end_date'] },
  )

export const renameTripSchema = z.object({ title: z.string().trim().min(1, 'Title is required').max(80, 'Title is too long') })

export const newStopSchema = z.object({
  place_id: z.uuid(),
  time: time.optional(),
  note: z.string().trim().max(280, 'Note is too long').optional(),
})

export const patchStopSchema = z
  .object({
    time: time.nullable().optional(),
    note: z.string().trim().max(280, 'Note is too long').nullable().optional(),
    day_id: z.uuid().optional(),
    position: z.number().int().min(1).max(200).optional(),
  })
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change')
  // `position` alone reorders within the stop's day; `day_id` moves it and needs a position too.
  .refine((p) => p.day_id === undefined || p.position !== undefined, { message: 'A move needs a position', path: ['position'] })

export const savedSchema = z.object({ entity_type: z.enum(['place', 'dish', 'journey']), entity_id: z.uuid() })

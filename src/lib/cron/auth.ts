import { timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'

/**
 * Guard for cron routes: null when `Authorization: Bearer ${CRON_SECRET}` matches, else a 401.
 * An unset or empty CRON_SECRET rejects everything (never matches an empty token).
 */
export function requireCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (secret && header?.startsWith('Bearer ')) {
    const given = Buffer.from(header.slice('Bearer '.length))
    const expected = Buffer.from(secret)
    if (given.length === expected.length && timingSafeEqual(given, expected)) return null
  }
  return apiError('UNAUTHORIZED', 'Invalid or missing cron credentials', 401)
}

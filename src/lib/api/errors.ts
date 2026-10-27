import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'FX_UNAVAILABLE'
  | 'ROUTING_UNAVAILABLE'
  | 'INTERNAL';

export function apiError(code: ApiErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

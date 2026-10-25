import type { NextResponse } from 'next/server';
import type { z } from 'zod';
import { apiError } from './errors';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

function parse<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: apiError('VALIDATION', result.error.issues[0]?.message ?? 'Invalid input', 400),
  };
}

export function parseQuery<T>(schema: z.ZodType<T>, params: URLSearchParams): ParseResult<T> {
  return parse(schema, Object.fromEntries(params));
}

export async function parseBody<T>(schema: z.ZodType<T>, req: Request): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: apiError('VALIDATION', 'Request body must be valid JSON', 400) };
  }
  return parse(schema, json);
}

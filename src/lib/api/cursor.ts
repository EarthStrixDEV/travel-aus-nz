import { z } from 'zod';

export type Cursor = { sort: string | number; id: string };

export function encodeCursor(c: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Never throws: any malformed or tampered input yields null. */
export function decodeCursor(s: string): Cursor | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const { sort, id } = raw as Record<string, unknown>;
    if (typeof id !== 'string') return null;
    if (typeof sort === 'string' || (typeof sort === 'number' && Number.isFinite(sort))) {
      return { sort, id };
    }
    return null;
  } catch {
    return null;
  }
}

export const paginationSchema = z.object({
  cursor: z
    .string()
    .optional()
    .transform((s, ctx): Cursor | undefined => {
      if (s === undefined) return undefined;
      const decoded = decodeCursor(s);
      if (decoded === null) {
        ctx.addIssue({ code: 'custom', message: 'invalid cursor' });
        return z.NEVER;
      }
      return decoded;
    }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

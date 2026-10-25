import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { encodeCursor, paginationSchema } from './cursor';
import { parseBody, parseQuery } from './validate';

async function failure(r: Awaited<ReturnType<typeof parseQuery>>) {
  if (r.ok) throw new Error('expected failure');
  expect(r.response.status).toBe(400);
  const body = await r.response.json();
  expect(body.error.code).toBe('VALIDATION');
  return body.error.message as string;
}

describe('parseQuery + paginationSchema', () => {
  it('defaults to limit 20 with no cursor', () => {
    const r = parseQuery(paginationSchema, new URLSearchParams(''));
    expect(r).toEqual({ ok: true, data: { limit: 20 } });
  });

  it('decodes a valid cursor', () => {
    const cursor = { sort: 5, id: 'a' };
    const r = parseQuery(
      paginationSchema,
      new URLSearchParams({ cursor: encodeCursor(cursor), limit: '50' }),
    );
    expect(r).toEqual({ ok: true, data: { cursor, limit: 50 } });
  });

  it('rejects a garbage cursor with 400 VALIDATION', async () => {
    const msg = await failure(parseQuery(paginationSchema, new URLSearchParams('cursor=garbage')));
    expect(msg).toBe('invalid cursor');
  });

  it('rejects a tampered cursor (valid base64, wrong shape)', async () => {
    const bad = Buffer.from('{"sort":{},"id":1}').toString('base64url');
    await failure(parseQuery(paginationSchema, new URLSearchParams({ cursor: bad })));
  });

  it.each(['0', '101', '-1', '1.5', 'abc'])('rejects limit=%s with 400', async (limit) => {
    await failure(parseQuery(paginationSchema, new URLSearchParams({ limit })));
  });
});

describe('parseBody', () => {
  const schema = z.object({ name: z.string() });
  const post = (body: BodyInit | null, headers?: HeadersInit) =>
    new Request('http://x.test/', { method: 'POST', body, headers });

  it('parses a valid JSON body', async () => {
    const r = await parseBody(schema, post('{"name":"a"}'));
    expect(r).toEqual({ ok: true, data: { name: 'a' } });
  });

  it('rejects non-JSON with 400 VALIDATION', async () => {
    await failure(await parseBody(schema, post('not json')));
  });

  it('rejects an empty body with 400 VALIDATION', async () => {
    await failure(await parseBody(schema, post('')));
    await failure(await parseBody(schema, post(null)));
  });

  it('rejects a schema mismatch with the first issue message', async () => {
    const msg = await failure(await parseBody(schema, post('{"name":1}')));
    expect(msg.length).toBeGreaterThan(0);
  });
});

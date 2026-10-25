import { describe, expect, it } from 'vitest';
import { apiError } from './errors';

describe('apiError', () => {
  it('returns the { error: { code, message } } shape with the given status', async () => {
    const res = apiError('NOT_FOUND', 'x', 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'x' } });
  });
});

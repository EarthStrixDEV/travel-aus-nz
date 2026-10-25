import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('round-trips a numeric sort cursor', () => {
    const c = { sort: 5, id: 'a' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('round-trips a string sort cursor', () => {
    const c = { sort: '2026-01-01T00:00:00Z', id: 'b' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('produces url-safe output', () => {
    expect(encodeCursor({ sort: '???>>>', id: '~~~' })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for bad base64', () => {
    expect(decodeCursor('%%%')).toBeNull();
  });

  it('returns null for bad JSON', () => {
    expect(decodeCursor(btoa('not json'))).toBeNull();
  });

  it('returns null for wrong shape', () => {
    expect(decodeCursor(btoa('{"x":1}'))).toBeNull();
    expect(decodeCursor(btoa('null'))).toBeNull();
    expect(decodeCursor(btoa('[]'))).toBeNull();
  });

  it('returns null for wrong field types', () => {
    expect(decodeCursor(btoa('{"sort":true,"id":"a"}'))).toBeNull();
    expect(decodeCursor(btoa('{"sort":1,"id":2}'))).toBeNull();
    expect(decodeCursor(btoa('{"sort":null,"id":"a"}'))).toBeNull();
  });

  it('returns null for empty string and non-finite sort', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(btoa('{"sort":"x"}'))).toBeNull();
  });
});

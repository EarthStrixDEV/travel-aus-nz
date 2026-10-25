import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture } }));

import { track } from './track';

beforeEach(() => {
  capture.mockReset();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('track', () => {
  it('drops PII-keyed props and keeps the rest', () => {
    track('search', { q: 'flat white', email: 'a@b.c' });
    expect(capture).toHaveBeenCalledWith('search', { q: 'flat white' });
  });

  it('drops string values containing @', () => {
    track('place_view', { slug: 'x', note: 'me@x.com' });
    expect(capture).toHaveBeenCalledWith('place_view', { slug: 'x' });
  });

  it('drops every PII key pattern, case-insensitively', () => {
    track('save_item', {
      Email: 'x',
      fullName: 'x',
      phone_no: 'x',
      passportNo: 'x',
      nationality: 'x',
      birthDate: 'x',
      ip: 'x',
      kind: 'place',
    });
    expect(capture).toHaveBeenCalledWith('save_item', { kind: 'place' });
  });

  it('keeps numbers and booleans', () => {
    track('fx_convert', { amount: 10, saved: true });
    expect(capture).toHaveBeenCalledWith('fx_convert', { amount: 10, saved: true });
  });

  it('sends empty props when none are given', () => {
    track('checklist_complete');
    expect(capture).toHaveBeenCalledWith('checklist_complete', {});
  });

  it('is a no-op when NEXT_PUBLIC_POSTHOG_KEY is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    track('search', { q: 'x' });
    expect(capture).not.toHaveBeenCalled();
  });
});

import posthog from 'posthog-js';

export type AnalyticsEvent =
  | 'search'
  | 'place_view'
  | 'save_item'
  | 'fx_convert'
  | 'visa_official_click'
  | 'checklist_complete';

export type AnalyticsProps = Record<string, string | number | boolean>;

// Props are flat by type, so key + value checks are sufficient (no nested objects to hide PII in).
const PII_KEY = /email|name|phone|passport|nationality|birth|ip/i;

function sanitize(props: AnalyticsProps): AnalyticsProps {
  const safe: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEY.test(key)) continue;
    if (typeof value === 'string' && value.includes('@')) continue;
    safe[key] = value;
  }
  return safe;
}

/** Send a product-analytics event. No-op when PostHog is not configured. */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, sanitize(props));
}

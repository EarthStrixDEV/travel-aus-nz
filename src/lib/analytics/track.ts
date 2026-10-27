import posthog from 'posthog-js';

export type AnalyticsEvent =
  | 'search'
  | 'place_view'
  | 'save_item'
  | 'fx_convert'
  | 'visa_official_click'
  | 'checklist_complete'
  | 'checklist_toggle'
  | 'route_plan';

export type AnalyticsProps = Record<string, string | number | boolean>;

// Props are flat by type, so key + value checks are sufficient (no nested objects to hide PII in).
// Keys are split into whole tokens (`_`, `-`, camelCase) so `trip_id`/`zip` pass but
// `client_ip`/`firstName` are dropped. Any key containing a PII token is dropped (fail safe).
const PII_TOKENS = new Set([
  'email', 'name', 'phone', 'passport', 'nationality',
  'birth', 'birthday', 'dob', 'ip', 'ipaddress',
]);

function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

const isPiiKey = (key: string) => keyTokens(key).some((t) => PII_TOKENS.has(t));

function sanitize(props: AnalyticsProps): AnalyticsProps {
  const safe: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (isPiiKey(key)) continue;
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

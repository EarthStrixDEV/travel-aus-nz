'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: 'history_change',
      // Autocapture can record input/click text that may hold PII; only explicit track() events are sent.
      autocapture: false,
    });
  }, []);

  return <>{children}</>;
}

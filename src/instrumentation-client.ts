import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // @sentry/nextjs v11 replaced `sendDefaultPii` with `dataCollection`; these turn off the PII sources.
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

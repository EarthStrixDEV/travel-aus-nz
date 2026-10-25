import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { imageWidthConfig } from "./src/lib/media/image-config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Public photos live in the Supabase Storage `media` bucket; `next/image` may only optimise those.
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  // Admin media uploads go through a server action (cap enforced in admin/media/schema.ts: 10 MB + form fields).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  images: {
    // Spec §6 media rules: AVIF/WebP in exactly three widths (480 / 960 / 1920), see lib/media/image-config.ts.
    ...imageWidthConfig,
    formats: ["image/avif", "image/webp"],
    remotePatterns: storageUrl
      ? [
          {
            protocol: storageUrl.protocol === "http:" ? "http" : "https",
            hostname: storageUrl.hostname,
            ...(storageUrl.port ? { port: storageUrl.port } : {}),
            pathname: "/storage/v1/object/public/media/**",
          },
        ]
      : [],
  },
};

// Sentry wrapper is inert without SENTRY_AUTH_TOKEN: no source-map upload, no build noise.
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
});

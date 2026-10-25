import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ThemeSync } from "@/components/theme-sync";
import { routing } from "@/i18n/routing";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "../globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin", "thai"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("siteName") };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    // The theme class is applied by THEME_INIT_SCRIPT (not React) before paint; ThemeSync
    // re-applies it when a TH<->EN soft navigation remounts this root layout.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${prompt.variable} ${prompt.className} bg-bg text-ink`}>
        <NextIntlClientProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </NextIntlClientProvider>
        <Analytics />
        <ThemeSync />
      </body>
    </html>
  );
}

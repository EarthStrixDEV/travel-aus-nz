import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { parseThemeCookie, THEME_COOKIE, themeClass } from "@/lib/theme";
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
  const theme = themeClass(parseThemeCookie((await cookies()).get(THEME_COOKIE)?.value));

  return (
    <html lang={locale} className={theme || undefined}>
      <body className={`${prompt.variable} ${prompt.className} bg-bg text-ink`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

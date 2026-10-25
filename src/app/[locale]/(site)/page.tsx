import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("siteName")}</h1>
    </main>
  );
}

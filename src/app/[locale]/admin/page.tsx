import { redirect } from '@/i18n/navigation'

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect({ href: '/admin/cities', locale })
}

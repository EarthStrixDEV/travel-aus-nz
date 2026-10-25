import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { permissionOptions } from '../../../_lib/options'
import { str, type FormValues } from '../../../_lib/values'
import { RuleForm } from '../../forms'
import { parseRuleKey, ruleKey } from '../../schema'

export default async function RuleEditPage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key: rawKey } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawKey === 'new'
  const key = isNew ? null : parseRuleKey(rawKey)
  if (!isNew && !key) notFound()

  const supabase = await createClient()
  const permissions = await permissionOptions(supabase, locale)

  let values: FormValues = { nationality: '', country: 'AU', purpose: 'tourism', stay: 'lt1', permission_id: '', needs_review: 'false' }
  if (key) {
    const { data: r, error } = await supabase.from('entry_rules').select('*').match(key).maybeSingle()
    if (error) throw new Error('Failed to load entry rule')
    if (!r) notFound()
    values = {
      nationality: r.nationality,
      country: r.country,
      purpose: r.purpose,
      stay: r.stay,
      permission_id: str(r.permission_id),
      verified_at: str(r.verified_at),
      needs_review: String(r.needs_review ?? false),
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('entry.newRule') : t('entry.editRule')}</h1>
      <RuleForm originalKey={key ? ruleKey(key) : null} values={values} permissions={permissions} />
    </>
  )
}

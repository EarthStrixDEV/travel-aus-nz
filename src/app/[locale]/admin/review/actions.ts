'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/profile'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Mark a `content_feedback` row resolved. That table has no client policies (service-role
 * only), so this uses the service client — behind the role check, since actions are public.
 */
export async function resolveFeedback(formData: FormData): Promise<void> {
  await requireRole(['editor', 'admin'])
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return
  const { error } = await createServiceClient().from('content_feedback').update({ resolved: true }).eq('id', id.data)
  if (error) throw new Error('Failed to resolve feedback')
  revalidatePath('/[locale]/admin/review', 'page')
}

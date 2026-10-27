import 'server-only'
import { after } from 'next/server'
import { redisRouteCache } from '@/lib/routing/cache'
import { googleRoutes } from '@/lib/routing/google'
import { planRoute } from '@/lib/routing/plan'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient } from '@/lib/supabase/service'
import { recomputeStaleLegs, type Planner } from './legs'

/** The production planner: same provider, cache and place lookup as `GET /api/v1/routes/plan`. */
export const routePlanner: Planner = (input) => planRoute(input, { provider: googleRoutes, db: createPublicClient(), cache: redisRouteCache() })

/**
 * After a stop change, recompute that trip's stale legs once the response has gone out (Next `after()`).
 * Failures are only logged: the `leg-recompute` cron retries anything still stale.
 */
export function scheduleLegRecompute(tripId: string): void {
  after(async () => {
    try {
      await recomputeStaleLegs(createServiceClient(), routePlanner, { tripId })
    } catch (err) {
      console.error('[leg-recompute] after-response run failed', err)
    }
  })
}

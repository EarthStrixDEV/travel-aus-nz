import type { Point, RouteOption } from './types'

export type PlanRequest = { from: Point; to: Point; departUtc: Date }

export interface RoutingProvider {
  name: string
  /**
   * Up to 3 transit options, **without** fares or cards (`fare_min`/`fare_max`/`card` null).
   * Fewer than 3, or none, is a normal result. Throws `RoutingUnavailable` on timeout, non-2xx or a missing key.
   */
  plan(input: PlanRequest): Promise<RouteOption[]>
}

/** The provider could not answer; the API turns this into 503 `ROUTING_UNAVAILABLE` with a curated fallback. */
export class RoutingUnavailable extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'RoutingUnavailable'
  }
}

export const ROUTING_TIMEOUT_MS = 8000

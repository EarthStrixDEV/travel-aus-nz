'use client'

import { useCallback } from 'react'
import { useAuth } from './auth-provider'
import { useLoginGate } from './login-required-dialog'

/**
 * Wraps a login-gated action. Signed in -> runs it. Guest -> opens the login dialog and
 * never runs it. Before the session is known (`ready` false) it does nothing.
 */
export function useRequireLogin(): (action: () => void) => void {
  const { user, ready } = useAuth()
  const { open } = useLoginGate()
  return useCallback(
    (action) => {
      if (!ready) return
      if (user) action()
      else open()
    },
    [ready, user, open],
  )
}

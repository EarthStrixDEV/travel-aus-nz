'use client'

import type { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/browser'

type AuthState = { user: User | null; ready: boolean }

const AuthContext = createContext<AuthState>({ user: null, ready: false })

/**
 * Client-side auth state from the browser Supabase client, so public pages stay static
 * (no server cookie read). `ready` flips once the stored session has been read; the
 * session is used for UI only, the server re-verifies with `getUser()` on gated routes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false })

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setState({ user: data.session?.user ?? null, ready: true })
      })
      .catch(() => {
        if (active) setState({ user: null, ready: true })
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, ready: true })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

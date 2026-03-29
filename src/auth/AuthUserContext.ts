import { createContext, useContext } from 'react'
import type { BaseAuthUser } from '@haderach/shared-ui'

export type AuthUser = BaseAuthUser

export const AuthUserContext = createContext<AuthUser | null>(null)

export function useAuthUser(): AuthUser {
  const ctx = useContext(AuthUserContext)
  if (!ctx) throw new Error('useAuthUser must be used within AuthGate')
  return ctx
}

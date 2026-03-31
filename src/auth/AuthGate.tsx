import { useMemo, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { fetchUserDoc, buildDisplayName, hasAppAccess, getAccessibleApps, getAccessibleAdminApps, APP_CATALOG, ADMIN_CATALOG, APP_ID } from './accessPolicy'
import { getAuthRuntimeConfig } from './runtimeConfig'
import { AuthUserContext } from './AuthUserContext'
import { Button } from '@haderach/shared-ui'

const APP_PATH = '/admin/vendors/'

interface AuthGateProps {
  children: ReactNode
}

function getFirebaseAppInstance(): FirebaseApp | null {
  const runtimeConfig = getAuthRuntimeConfig()
  if (!runtimeConfig.firebaseConfig) {
    return null
  }
  if (getApps().length > 0) {
    return getApp()
  }
  return initializeApp(runtimeConfig.firebaseConfig)
}

type AuthStatus = 'loading' | 'redirecting' | 'sign_in' | 'authorized' | 'unauthorized' | 'config_error'

export function AuthGate({ children }: AuthGateProps) {
  const runtimeConfig = useMemo(() => getAuthRuntimeConfig(), [])
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [displayName, setDisplayName] = useState<string | undefined>()
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (runtimeConfig.bypassAuth) {
      return 'authorized'
    }
    if (runtimeConfig.configError) {
      return 'config_error'
    }
    return 'loading'
  })
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    if (runtimeConfig.bypassAuth || runtimeConfig.configError) {
      return
    }
    const app = getFirebaseAppInstance()
    if (!app) {
      setStatus('config_error')
      return
    }
    const auth = getAuth(app)
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        if (import.meta.env.DEV) {
          setStatus('sign_in')
        } else {
          setStatus('redirecting')
          window.location.replace(
            `/?returnTo=${encodeURIComponent(APP_PATH)}`,
          )
        }
        return
      }
      setStatus('loading')
      fetchUserDoc(() => nextUser.getIdToken()).then((userDoc) => {
        const fetchedRoles = userDoc.roles
        setRoles(fetchedRoles)
        setDisplayName(buildDisplayName(userDoc.firstName, userDoc.lastName))
        if (hasAppAccess(fetchedRoles, APP_ID)) {
          setStatus('authorized')
        } else {
          setStatus('unauthorized')
        }
      })
    })
    setPersistence(auth, browserLocalPersistence).catch(() => {})
    return unsubscribe
  }, [runtimeConfig.bypassAuth, runtimeConfig.configError])

  const signOutCurrentUser = async () => {
    const app = getFirebaseAppInstance()
    if (!app) {
      setStatus('config_error')
      return
    }
    setAuthBusy(true)
    try {
      await signOut(getAuth(app))
    } finally {
      setAuthBusy(false)
    }
  }

  if (status === 'authorized') {
    const accessibleApps = runtimeConfig.bypassAuth
      ? [...APP_CATALOG, ...ADMIN_CATALOG]
      : [...getAccessibleApps(roles), ...getAccessibleAdminApps(roles)]
    return (
      <AuthUserContext.Provider
        value={{
          email: user?.email ?? (runtimeConfig.bypassAuth ? 'dev@haderach.ai' : ''),
          photoURL: user?.photoURL ?? undefined,
          displayName: runtimeConfig.bypassAuth ? 'Dev User' : displayName,
          accessibleApps,
          signOut: signOutCurrentUser,
          getIdToken: async () => user?.getIdToken() ?? '',
        }}
      >
        {children}
      </AuthUserContext.Provider>
    )
  }

  if (status === 'loading' || status === 'redirecting') {
    return null
  }

  if (status === 'sign_in') {
    const handleDevSignIn = async () => {
      const app = getFirebaseAppInstance()
      if (!app) return
      setAuthBusy(true)
      try {
        await signInWithPopup(getAuth(app), new GoogleAuthProvider())
      } catch {
        setAuthBusy(false)
      }
    }
    return (
      <main className="auth-gate-shell">
        <section className="auth-gate-card" aria-live="polite">
          <h1>Local Development Sign-in</h1>
          <p>Sign in with your Google account to test with real auth.</p>
          <div className="auth-gate-actions">
            <Button onClick={handleDevSignIn} disabled={authBusy}>
              Sign in with Google
            </Button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-gate-shell">
      <section className="auth-gate-card" aria-live="polite">
        {status === 'config_error' ? (
          <>
            <h1>Unavailable</h1>
            <p>
              Authentication is unavailable because runtime configuration is missing. Please contact
              your administrator.
            </p>
          </>
        ) : (
          <>
            <h1>Access denied</h1>
            <p>
              You are signed in as <strong>{user?.email || 'unknown user'}</strong>, but your
              account does not have access to this application.
            </p>
            <p>Please contact your administrator to be granted access.</p>
            <div className="auth-gate-actions">
              <Button onClick={signOutCurrentUser} disabled={authBusy}>
                Sign out
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

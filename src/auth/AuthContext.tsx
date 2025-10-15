import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, type User } from 'firebase/auth'
import { auth, firebaseInitialized } from '../lib/firebase'

type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseInitialized || !auth) {
      console.warn('[AuthContext] Firebase not initialized; auth unavailable.')
      setUser(null)
      setLoading(false)
      return
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function login(email: string, password: string) {
    if (!firebaseInitialized || !auth) throw new Error('Auth não inicializado')
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (!firebaseInitialized || !auth) throw new Error('Auth não inicializado')
    await signOut(auth)
  }

  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@prefeitura.local').toLowerCase()
  const isAdmin = !!user && (user.email?.toLowerCase() === adminEmail)

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}

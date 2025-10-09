import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth'
import type { User } from 'firebase/auth'
 
import { auth } from '../lib/firebase'

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
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u)
            setLoading(false)
        })
        return () => unsub()
    }, [])

    async function login(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password)
    }

    async function logout() {
        await signOut(auth)
    }

    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@prefeitura.local'
    const isAdmin = !!user && user.email === adminEmail

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

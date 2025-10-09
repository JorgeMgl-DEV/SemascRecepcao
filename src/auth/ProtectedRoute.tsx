import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth()
    if (loading) return <div style={{ padding: 16 }}>Carregando...</div>
    if (!user) return <Navigate to="/" replace />
    return <>{children}</>
}

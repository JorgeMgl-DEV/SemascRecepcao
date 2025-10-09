import type { FormEvent } from 'react'
import { useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
    const { login, isAdmin } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setError(null)
        try {
            await login(email.trim(), password)
            navigate(isAdmin ? '/admin' : '/recepcao', { replace: true })
        } catch {
            setError('Falha no login. Verifique e tente novamente.')
        }
    }


    return (
        <div className="container" style={{ maxWidth: 420 }}>
            <h1 className="mt-8">Sistema de Recepção — Assistência Social</h1>
            <form onSubmit={onSubmit} className="grid grid-1 mt-12" style={{ gap: 12 }}>
                <label>Email
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label>Senha
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                {error && <div className="muted" style={{ color: 'crimson' }}>{error}</div>}
                <button type="submit" className="btn mt-8">Entrar</button>
            </form>
            <p className="muted mt-12">Use as credenciais fornecidas.</p>
        </div>
    )
}



import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    try {
      await login(email.trim(), password)
      // Redireciona sempre pra /home — o RoleRedirect decide pra onde ir
      navigate('/home', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Usuário ou senha inválidos.')
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Carregando...</div>

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f5f5f5'
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'white', padding: 32, borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: 320
      }}>
        <h2 style={{ marginBottom: 16, textAlign: 'center' }}>Acesso ao Sistema</h2>

        <label style={{ display: 'block', marginBottom: 8 }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>

        {error && (
          <div style={{ color: 'red', marginBottom: 8, fontSize: 14 }}>{error}</div>
        )}

        <button
          type="submit"
          style={{
            width: '100%', padding: 10, marginTop: 12,
            background: '#004AAD', color: 'white',
            border: 'none', borderRadius: 4, cursor: 'pointer'
          }}
        >
          Entrar
        </button>
      </form>
    </div>
  )
}

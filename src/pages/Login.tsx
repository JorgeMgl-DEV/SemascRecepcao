"use client"

import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"

export default function Login() {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    try {
      await login(email.trim(), password)
      navigate("/home", { replace: true })
    } catch (err) {
      console.error(err)
      setError("Usuário ou senha inválidos.")
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "var(--color-text-secondary)",
        }}
      >
        Carregando...
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "1rem",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          padding: "2.5rem",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "var(--color-primary)",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "2rem",
            }}
          >
            🏛️
          </div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Sistema de Recepção</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Secretaria de Assistência Social</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu.email@prefeitura.gov.br"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius)",
                color: "var(--color-error)",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn-accent" style={{ width: "100%", padding: "0.875rem", fontSize: "1rem" }}>
            Entrar no Sistema
          </button>
        </form>

        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--color-border-light)",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--color-text-muted)",
          }}
        >
          Sistema de Gestão Municipal • Versão 1.0
        </div>
      </div>
    </div>
  )
}

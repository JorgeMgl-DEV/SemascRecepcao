"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import type { Timestamp } from "firebase/firestore"
import { db, firebaseInitialized } from "../lib/firebase"
import { SERVICES } from "../data/services"
import { useAuth } from "../auth/AuthContext"

type Atendimento = {
  id?: string
  nome: string
  cpf: string // apenas dígitos
  servico: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  diaKey: string // YYYY-MM-DD
  criadoPor: string
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "")
}
function maskCpfInput(v: string) {
  const s = onlyDigits(v).slice(0, 11)
  // exibe no input com máscara leve 000.000.000-00
  const p1 = s.slice(0, 3)
  const p2 = s.slice(3, 6)
  const p3 = s.slice(6, 9)
  const p4 = s.slice(9, 11)
  let out = p1
  if (p2) out += "." + p2
  if (p3) out += "." + p3
  if (p4) out += "-" + p4
  return out
}
function cpfToDigits(masked: string) {
  return onlyDigits(masked).slice(0, 11)
}
function displayCpfMasked(digits: string) {
  if (digits.length !== 11) return "***.***.***-**"
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
function todayKeyLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function Recepcao() {
  const { user, logout } = useAuth()
  const [nome, setNome] = useState("")
  const [cpfMasked, setCpfMasked] = useState("")
  const [servico, setServico] = useState<string>(SERVICES[0])
  const [erro, setErro] = useState<string | null>(null)
  const [items, setItems] = useState<Atendimento[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const diaKey = useMemo(() => todayKeyLocal(), [])

  // Assina a lista do dia
  useEffect(() => {
    if (!firebaseInitialized || !db) {
      setItems([])
      return
    }

    const q = query(collection(db, "atendimentos"), where("diaKey", "==", diaKey), orderBy("createdAt", "desc"))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Atendimento[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }))
        setItems(list)
      },
      (err) => {
        console.error('[Recepcao] onSnapshot error:', err)
        // show a simple message in UI by setting items empty and showing error state
        setItems([])
        setErro('Falha ao conectar com o banco. Tente recarregar a página ou contate o administrador.')
      },
    )

    return () => unsub()
  }, [diaKey])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const cpf = cpfToDigits(cpfMasked)
    if (!nome.trim()) return setErro("Informe o nome.")
    if (cpf.length !== 11) return setErro("CPF deve ter 11 dígitos.")

    try {
      if (!firebaseInitialized || !db) throw new Error('Firebase não inicializado')

      await addDoc(collection(db, "atendimentos"), {
        nome: nome.trim(),
        cpf,
        servico,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        diaKey,
        criadoPor: user?.uid ?? "unknown",
      })
      // limpa form
      setNome("")
      setCpfMasked("")
      setServico(SERVICES[0])
    } catch {
      setErro("Falha ao salvar. Tente novamente. (ver console para detalhes)")
    }
  }

  function beginEdit(id: string) {
    setEditingId(id)
  }
  async function saveInline(id: string, field: "nome" | "cpf" | "servico", value: string) {
    const payload: any = { updatedAt: serverTimestamp() }
    if (field === "cpf") {
      payload.cpf = cpfToDigits(value)
      if (payload.cpf.length !== 11) return // ignora salvar cpf inválido
    } else {
      payload[field] = value.trim()
    }
    if (!firebaseInitialized || !db) {
      setErro('Firebase não inicializado')
      setEditingId(null)
      return
    }
    await updateDoc(doc(db, "atendimentos", id), payload)
    setEditingId(null)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
        padding: "1.5rem",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            padding: "1.5rem",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            border: "1px solid var(--color-border-light)",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Recepção</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
              Secretaria de Assistência Social
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{user?.email}</span>
            <button onClick={() => logout()} className="btn-secondary btn-sm">
              Sair
            </button>
          </div>
        </header>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Novo Atendimento</h2>
          <form
            onSubmit={onSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <label htmlFor="nome">Nome Completo</label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Digite o nome do cidadão"
              />
            </div>

            <div>
              <label htmlFor="cpf">CPF</label>
              <input
                id="cpf"
                value={cpfMasked}
                onChange={(e) => setCpfMasked(maskCpfInput(e.target.value))}
                inputMode="numeric"
                required
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label htmlFor="servico">Serviço Solicitado</label>
              <select id="servico" value={servico} onChange={(e) => setServico(e.target.value)}>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="btn-accent" style={{ width: "100%" }}>
                Registrar Atendimento
              </button>
            </div>

            {erro && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: "0.75rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius)",
                  color: "var(--color-error)",
                  fontSize: "0.875rem",
                }}
              >
                {erro}
              </div>
            )}
          </form>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2>Atendimentos de Hoje</h2>
            <span
              style={{
                padding: "0.375rem 0.75rem",
                background: "var(--color-border-light)",
                borderRadius: "var(--radius)",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              {diaKey} • {items.length} {items.length === 1 ? "atendimento" : "atendimentos"}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Serviço</th>
                  <th style={{ width: "120px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      {editingId === it.id ? (
                        <input
                          defaultValue={it.nome}
                          onBlur={(e) => saveInline(it.id!, "nome", e.target.value)}
                          autoFocus
                        />
                      ) : (
                        it.nome
                      )}
                    </td>

                    <td>
                      {editingId === it.id ? (
                        <input defaultValue={it.cpf} onBlur={(e) => saveInline(it.id!, "cpf", e.target.value)} />
                      ) : (
                        displayCpfMasked(it.cpf)
                      )}
                    </td>

                    <td>
                      {editingId === it.id ? (
                        <select
                          defaultValue={it.servico}
                          onChange={(e) => saveInline(it.id!, "servico", e.target.value)}
                        >
                          {SERVICES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        it.servico
                      )}
                    </td>

                    <td>
                      {editingId === it.id ? (
                        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Editando...</span>
                      ) : (
                        <button onClick={() => beginEdit(it.id!)} className="btn-secondary btn-sm">
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        padding: "3rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Nenhum atendimento registrado hoje.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

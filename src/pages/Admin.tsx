"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import type { Timestamp } from "firebase/firestore"
import { db, firebaseInitialized } from "../lib/firebase"
import { useAuth } from "../auth/AuthContext"
import { SERVICES } from "../data/services"
import { exportToCSV, exportToXLSX, exportSummaryXLSX } from "../utils/exporters"

type Atendimento = {
  id: string
  nome: string
  cpf: string
  servico: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  diaKey: string // YYYY-MM-DD
  criadoPor: string
}

function toDayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}
function displayCpfMasked(digits: string) {
  if (!digits || digits.length !== 11) return "***.***.***-**"
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
function tsToLocalDate(ts?: Timestamp): Date | null {
  return ts ? ts.toDate() : null
}

export default function Admin() {
  const { user, logout } = useAuth()

  const today = useMemo(() => new Date(), [])
  const [start, setStart] = useState(toDayKey(today))
  const [end, setEnd] = useState(toDayKey(today))
  const [servico, setServico] = useState<string>("(todos)")
  const [nome, setNome] = useState("")
  const [cpf, setCpf] = useState("")

  const [rows, setRows] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<Atendimento | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  async function fetchData() {
    setLoading(true)
    try {
      if (!firebaseInitialized || !db) throw new Error('Firebase não inicializado')

      const clauses: any[] = [where("diaKey", ">=", start), where("diaKey", "<=", end)]
      if (servico !== "(todos)") clauses.push(where("servico", "==", servico))
      const q = query(collection(db, "atendimentos"), ...clauses)
      const snap = await getDocs(q)
      let list: Atendimento[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }))

      const nomeTerm = nome.trim().toLowerCase()
      const cpfTerm = cpf.replace(/\D/g, "")
      if (nomeTerm) list = list.filter((x) => x.nome?.toLowerCase().includes(nomeTerm))
      if (cpfTerm) list = list.filter((x) => x.cpf?.includes(cpfTerm))

      list.sort((a, b) => (a.diaKey < b.diaKey ? 1 : a.diaKey > b.diaKey ? -1 : 0))
      setRows(list)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line

  const total = rows.length
  const porServico = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => map.set(r.servico, (map.get(r.servico) || 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])

  const porDia = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => map.set(r.diaKey, (map.get(r.diaKey) || 0) + 1))
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [rows])

  const porHora = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => [h, 0] as [number, number])
    rows.forEach((r) => {
      const d = tsToLocalDate(r.createdAt)
      if (!d) return
      buckets[d.getHours()][1]++
    })
    return buckets
  }, [rows])

  const maxDia = useMemo(() => porDia.reduce((m, [, n]) => Math.max(m, n), 0), [porDia])
  const maxHora = useMemo(() => porHora.reduce((m, [, n]) => Math.max(m, n), 0), [porHora])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const paginated = useMemo(() => {
    const startIdx = (page - 1) * pageSize
    return rows.slice(startIdx, startIdx + pageSize)
  }, [rows, page, pageSize])

  function exportResumos() {
    const tabDia = porDia.map(([dia, n]) => ({ Dia: dia, Total: n }))
    const tabHora = porHora.map(([h, n]) => ({ Hora: `${String(h).padStart(2, "0")}h`, Total: n }))
    const tabServ = porServico.map(([s, n]) => ({ Serviço: s, Total: n }))
    exportSummaryXLSX(`resumo_${start}_${end}`, {
      "Por dia": tabDia,
      "Por hora": tabHora,
      "Por serviço": tabServ,
    })
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
        padding: "1.5rem",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
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
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Painel Administrativo</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Relatórios e Análises</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{user?.email}</span>
            <button onClick={() => logout()} className="btn-secondary btn-sm">
              Sair
            </button>
          </div>
        </header>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Filtros</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label htmlFor="start">Data Início</label>
              <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="end">Data Fim</label>
              <input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <label htmlFor="servico">Serviço</label>
              <select id="servico" value={servico} onChange={(e) => setServico(e.target.value)}>
                <option>(todos)</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Buscar por nome" />
            </div>
            <div>
              <label htmlFor="cpf">CPF</label>
              <input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Apenas dígitos" />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={fetchData} className="btn-accent" style={{ width: "100%" }}>
                {loading ? "Carregando..." : "Aplicar Filtros"}
              </button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Resumo do Período</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                padding: "1.5rem",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "var(--radius-lg)",
                color: "white",
                boxShadow: "var(--shadow)",
              }}
            >
              <div style={{ fontSize: "0.875rem", opacity: 0.9, marginBottom: "0.5rem" }}>Total de Atendimentos</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 700 }}>{total}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: "0.5rem" }}>
                {start} até {end}
              </div>
            </div>

            <div
              style={{
                padding: "1.5rem",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-light)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.75rem",
                  fontWeight: 600,
                }}
              >
                Serviços Mais Solicitados
              </div>
              {porServico.length > 0 ? (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {porServico.slice(0, 3).map(([s, n]) => (
                    <li key={s} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                      <span style={{ color: "var(--color-text)" }}>{s}</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--color-accent)",
                          padding: "0.125rem 0.5rem",
                          background: "rgba(14, 165, 233, 0.1)",
                          borderRadius: "var(--radius)",
                        }}
                      >
                        {n}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Sem dados</div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => exportToCSV(`dashboard_${start}_${end}`, toExportRows(rows))}
              className="btn-secondary btn-sm"
            >
              📄 Exportar CSV
            </button>
            <button
              onClick={() => exportToXLSX(`dashboard_${start}_${end}`, toExportRows(rows))}
              className="btn-secondary btn-sm"
            >
              📊 Exportar Excel
            </button>
            <button onClick={exportResumos} className="btn-secondary btn-sm">
              📈 Exportar Resumos
            </button>
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <section>
            <h2 style={{ marginBottom: "1rem" }}>Atendimentos por Dia</h2>
            {porDia.length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", padding: "2rem", textAlign: "center" }}>
                Sem dados para o período
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {porDia.map(([dia, n]) => (
                  <BarRow key={dia} label={dia} value={n} max={maxDia} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ marginBottom: "1rem" }}>Distribuição por Horário</h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" }}
            >
              {porHora.map(([h, n]) => (
                <BarRow key={h} label={String(h).padStart(2, "0") + "h"} value={n} max={maxHora} />
              ))}
            </div>
            <small
              style={{ display: "block", marginTop: "0.75rem", color: "var(--color-text-muted)", fontSize: "0.75rem" }}
            >
              * Baseado no horário local do navegador
            </small>
          </section>
        </div>

        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <h2>Registros Detalhados</h2>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                Itens por página:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary btn-sm"
                >
                  ‹
                </button>
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-secondary btn-sm"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Serviço</th>
                  <th>Horário</th>
                  <th style={{ width: "120px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id}>
                    <td>{r.diaKey}</td>
                    <td>{r.nome}</td>
                    <td>{displayCpfMasked(r.cpf)}</td>
                    <td>{r.servico}</td>
                    <td>{tsToLocalDate(r.createdAt)?.toLocaleTimeString() ?? "—"}</td>
                    <td>
                      <button onClick={() => setDetail(r)} className="btn-secondary btn-sm">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "3rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Nenhum registro encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {detail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 50,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              padding: "2rem",
              width: "min(520px, 100%)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Detalhes do Atendimento</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  Data
                </div>
                <div style={{ fontSize: "0.875rem" }}>{detail.diaKey}</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  Nome
                </div>
                <div style={{ fontSize: "0.875rem" }}>{detail.nome}</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  CPF
                </div>
                <div style={{ fontSize: "0.875rem" }}>{detail.cpf}</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  Serviço
                </div>
                <div style={{ fontSize: "0.875rem" }}>{detail.servico}</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.25rem",
                  }}
                >
                  Horário
                </div>
                <div style={{ fontSize: "0.875rem" }}>{tsToLocalDate(detail.createdAt)?.toLocaleString() ?? "—"}</div>
              </div>
            </div>
            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setDetail(null)} className="btn-accent">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const widthPct = max > 0 ? (value / max) * 100 : 0
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 60px",
        alignItems: "center",
        gap: "1rem",
        padding: "0.5rem",
        background: "var(--color-surface)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border-light)",
      }}
    >
      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-text)",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: "var(--color-border-light)",
          height: "8px",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%)",
            borderRadius: "999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          textAlign: "right",
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function toExportRows(rows: Atendimento[]) {
  return rows.map((r) => ({
    Data: r.diaKey,
    Nome: r.nome,
    CPF: r.cpf,
    "CPF (mascarado)": displayCpfMasked(r.cpf),
    Serviço: r.servico,
    Horario: tsToLocalDate(r.createdAt)?.toLocaleTimeString() ?? "",
  }))
}

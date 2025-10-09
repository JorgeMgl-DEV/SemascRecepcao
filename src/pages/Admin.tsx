import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'
import { SERVICES } from '../data/services'
import { exportToCSV, exportToXLSX, exportSummaryXLSX } from '../utils/exporters'

type Atendimento = {
    id: string
    nome: string
    cpf: string
    servico: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
    diaKey: string       // YYYY-MM-DD
    criadoPor: string
}

function toDayKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
}
function displayCpfMasked(digits: string) {
    if (!digits || digits.length !== 11) return '***.***.***-**'
    return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
function tsToLocalDate(ts?: Timestamp): Date | null {
    return ts ? ts.toDate() : null
}

export default function Admin() {
    const { user, logout } = useAuth()

    // Filtros (sem hora)
    const today = useMemo(() => new Date(), [])
    const [start, setStart] = useState(toDayKey(today))
    const [end, setEnd] = useState(toDayKey(today))
    const [servico, setServico] = useState<string>('(todos)')
    const [nome, setNome] = useState('')
    const [cpf, setCpf] = useState('')

    // Dados
    const [rows, setRows] = useState<Atendimento[]>([])
    const [loading, setLoading] = useState(false)

    // Detalhe (modal)
    const [detail, setDetail] = useState<Atendimento | null>(null)

    // Paginação (client-side)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    async function fetchData() {
        setLoading(true)
        try {
            const clauses: any[] = [
                where('diaKey', '>=', start),
                where('diaKey', '<=', end),
            ]
            if (servico !== '(todos)') clauses.push(where('servico', '==', servico))
            const q = query(collection(db, 'atendimentos'), ...clauses)
            const snap = await getDocs(q)
            let list: Atendimento[] = []
            snap.forEach(d => list.push({ id: d.id, ...(d.data() as any) }))

            // client-side: nome/CPF parciais
            const nomeTerm = nome.trim().toLowerCase()
            const cpfTerm = cpf.replace(/\D/g, '')
            if (nomeTerm) list = list.filter(x => x.nome?.toLowerCase().includes(nomeTerm))
            if (cpfTerm) list = list.filter(x => x.cpf?.includes(cpfTerm))

            // ordena por diaKey desc
            list.sort((a, b) => (a.diaKey < b.diaKey ? 1 : (a.diaKey > b.diaKey ? -1 : 0)))
            setRows(list)
            setPage(1)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { fetchData() }, []) // eslint-disable-line

    // Agregações
    const total = rows.length
    const porServico = useMemo(() => {
        const map = new Map<string, number>()
        rows.forEach(r => map.set(r.servico, (map.get(r.servico) || 0) + 1))
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    }, [rows])

    const porDia = useMemo(() => {
        const map = new Map<string, number>()
        rows.forEach(r => map.set(r.diaKey, (map.get(r.diaKey) || 0) + 1))
        return Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? -1 : 1)
    }, [rows])

    const porHora = useMemo(() => {
        const buckets = Array.from({ length: 24 }, (_, h) => [h, 0] as [number, number])
        rows.forEach(r => {
            const d = tsToLocalDate(r.createdAt)
            if (!d) return
            buckets[d.getHours()][1]++
        })
        return buckets
    }, [rows])

    const maxDia = useMemo(() => porDia.reduce((m, [, n]) => Math.max(m, n), 0), [porDia])
    const maxHora = useMemo(() => porHora.reduce((m, [, n]) => Math.max(m, n), 0), [porHora])

    // Paginação
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    const paginated = useMemo(() => {
        const startIdx = (page - 1) * pageSize
        return rows.slice(startIdx, startIdx + pageSize)
    }, [rows, page, pageSize])

    // Export de resumos
    function exportResumos() {
        const tabDia = porDia.map(([dia, n]) => ({ Dia: dia, Total: n }))
        const tabHora = porHora.map(([h, n]) => ({ Hora: `${String(h).padStart(2, '0')}h`, Total: n }))
        const tabServ = porServico.map(([s, n]) => ({ Serviço: s, Total: n }))
        exportSummaryXLSX(`resumo_${start}_${end}`, {
            'Por dia': tabDia,
            'Por hora': tabHora,
            'Por serviço': tabServ,
        })
    }

    return (
        <div style={{ maxWidth: 1100, margin: '4vh auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <strong>Admin — Painel Geral</strong>
                <div>
                    <span style={{ marginRight: 8, color: '#555' }}>{user?.email}</span>
                    <button onClick={() => logout()} style={{ padding: '6px 10px' }}>Sair</button>
                </div>
            </header>

            {/* Filtros */}
            <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Filtros</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                    <label>Início
                        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
                    </label>
                    <label>Fim
                        <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
                    </label>
                    <label>Serviço
                        <select value={servico} onChange={e => setServico(e.target.value)}>
                            <option>(todos)</option>
                            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>
                    <label>Nome (contém)
                        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="parcial" />
                    </label>
                    <label>CPF (contém)
                        <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="apenas dígitos" />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                        <button onClick={fetchData} style={{ padding: '8px 10px' }}>Aplicar</button>
                    </div>
                </div>
            </section>

            {/* Resumo + Top serviços */}
            <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Resumo</h2>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ border: '1px solid #eee', padding: 10, minWidth: 180 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>Período</div>
                        <div>{start} → {end}</div>
                    </div>
                    <div style={{ border: '1px solid #eee', padding: 10, minWidth: 180 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>Total de atendimentos</div>
                        <div style={{ fontSize: 20, fontWeight: 600 }}>{total}</div>
                    </div>
                    <div style={{ border: '1px solid #eee', padding: 10, minWidth: 240 }}>
                        <div style={{ fontSize: 12, color: '#666' }}>Top serviços</div>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {porServico.slice(0, 3).map(([s, n]) => <li key={s}>{s}: {n}</li>)}
                            {porServico.length === 0 && <li>N/A</li>}
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => exportToCSV(`dashboard_${start}_${end}`, toExportRows(rows))} style={{ padding: '8px 10px' }}>
                        Exportar CSV (filtro atual)
                    </button>
                    <button onClick={() => exportToXLSX(`dashboard_${start}_${end}`, toExportRows(rows))} style={{ padding: '8px 10px' }}>
                        Exportar XLSX (filtro atual)
                    </button>
                    <button onClick={exportResumos} style={{ padding: '8px 10px' }}>
                        Exportar SOMENTE resumos (XLSX)
                    </button>
                </div>
            </section>

            {/* Gráfico: Atendimentos por dia */}
            <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Atendimentos por dia</h2>
                {porDia.length === 0 && <div style={{ color: '#666' }}>Sem dados para o período.</div>}
                <div style={{ display: 'grid', gap: 6 }}>
                    {porDia.map(([dia, n]) => (
                        <BarRow key={dia} label={dia} value={n} max={maxDia} />
                    ))}
                </div>
            </section>

            {/* Gráfico: Distribuição por horário (0–23h) */}
            <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Distribuição por horário (0–23h)</h2>
                <div style={{ display: 'grid', gap: 6 }}>
                    {porHora.map(([h, n]) => (
                        <BarRow key={h} label={String(h).padStart(2, '0') + 'h'} value={n} max={maxHora} />
                    ))}
                </div>
                <small style={{ color: '#666' }}>
                    *Baseado no horário local do navegador a partir de <code>createdAt</code>.
                </small>
            </section>

            {/* Tabela + paginação + detalhe */}
            <section style={{ border: '1px solid #ddd', padding: 12 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>
                    Planilha (visualização no navegador) {loading && <small style={{ color: '#666' }}>carregando…</small>}
                </h2>

                <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>Tamanho da página
                        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹ Anterior</button>
                        <span>pág. {page} / {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Próxima ›</button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={th}>Data</th>
                                <th style={th}>Nome</th>
                                <th style={th}>CPF (mascarado)</th>
                                <th style={th}>Serviço</th>
                                <th style={th}>Hora</th>
                                <th style={th}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map(r => (
                                <tr key={r.id}>
                                    <td style={td}>{r.diaKey}</td>
                                    <td style={td}>{r.nome}</td>
                                    <td style={td}>{displayCpfMasked(r.cpf)}</td>
                                    <td style={td}>{r.servico}</td>
                                    <td style={td}>{tsToLocalDate(r.createdAt)?.toLocaleTimeString() ?? ''}</td>
                                    <td style={td}>
                                        <button onClick={() => setDetail(r)}>Ver detalhes</button>
                                    </td>
                                </tr>
                            ))}
                            {paginated.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 8, color: '#666' }}>Sem registros para o filtro.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => exportToCSV(`atendimentos_${start}_${end}`, toExportRows(rows))} style={{ padding: '8px 10px' }}>
                        Exportar planilha (CSV)
                    </button>
                    <button onClick={() => exportToXLSX(`atendimentos_${start}_${end}`, toExportRows(rows))} style={{ padding: '8px 10px' }}>
                        Exportar planilha (XLSX)
                    </button>
                    <button onClick={() => window.print()} style={{ padding: '8px 10px' }}>
                        Imprimir / Salvar em PDF
                    </button>
                </div>
            </section>

            {/* Modal Detalhe */}
            {detail && (
                <div style={modalBackdrop} onClick={() => setDetail(null)}>
                    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Detalhes do atendimento</h3>
                        <p><b>Data:</b> {detail.diaKey}</p>
                        <p><b>Nome:</b> {detail.nome}</p>
                        <p><b>CPF:</b> {detail.cpf}</p>
                        <p><b>Serviço:</b> {detail.servico}</p>
                        <p><b>Horário:</b> {tsToLocalDate(detail.createdAt)?.toLocaleString() ?? '—'}</p>
                        <div style={{ marginTop: 12, textAlign: 'right' }}>
                            <button onClick={() => setDetail(null)}>Fechar</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 48px', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
            </div>
            <div style={{ background: '#eee', height: 10, borderRadius: 4 }}>
                <div style={{ width: `${widthPct}%`, height: '100%', borderRadius: 4, background: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: 12, textAlign: 'right' }}>{value}</div>
        </div>
    )
}

const th: React.CSSProperties = { borderBottom: '1px solid #ccc', textAlign: 'left', padding: 6 }
const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: 6 }

const modalBackdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50
}
const modalCard: React.CSSProperties = {
    background: '#fff', borderRadius: 8, padding: 16, width: 'min(520px, 100%)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.2)'
}

function toExportRows(rows: Atendimento[]) {
    return rows.map(r => ({
        Data: r.diaKey,
        Nome: r.nome,
        CPF: r.cpf,
        'CPF (mascarado)': displayCpfMasked(r.cpf),
        Serviço: r.servico,
        Horario: tsToLocalDate(r.createdAt)?.toLocaleTimeString() ?? '',
    }))
}

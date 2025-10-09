import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { SERVICES } from '../data/services'
import { useAuth } from '../auth/AuthContext'

type Atendimento = {
    id?: string
    nome: string
    cpf: string         // apenas dígitos
    servico: string
    createdAt: Timestamp
    updatedAt?: Timestamp
    diaKey: string      // YYYY-MM-DD
    criadoPor: string
}

function onlyDigits(s: string) {
    return s.replace(/\D/g, '')
}
function maskCpfInput(v: string) {
    const s = onlyDigits(v).slice(0, 11)
    // exibe no input com máscara leve 000.000.000-00
    const p1 = s.slice(0, 3)
    const p2 = s.slice(3, 6)
    const p3 = s.slice(6, 9)
    const p4 = s.slice(9, 11)
    let out = p1
    if (p2) out += '.' + p2
    if (p3) out += '.' + p3
    if (p4) out += '-' + p4
    return out
}
function cpfToDigits(masked: string) {
    return onlyDigits(masked).slice(0, 11)
}
function displayCpfMasked(digits: string) {
    if (digits.length !== 11) return '***.***.***-**'
    return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
function todayKeyLocal() {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

export default function Recepcao() {
    const { user, logout } = useAuth()
    const [nome, setNome] = useState('')
    const [cpfMasked, setCpfMasked] = useState('')
    const [servico, setServico] = useState<string>(SERVICES[0])
    const [erro, setErro] = useState<string | null>(null)
    const [items, setItems] = useState<Atendimento[]>([])
    const [editingId, setEditingId] = useState<string | null>(null)

    const diaKey = useMemo(() => todayKeyLocal(), [])

    // Assina a lista do dia
    useEffect(() => {
        const q = query(
            collection(db, 'atendimentos'),
            where('diaKey', '==', diaKey),
            orderBy('createdAt', 'desc'),
        )
        const unsub = onSnapshot(q, (snap) => {
            const list: Atendimento[] = []
            snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }))
            setItems(list)
        })
        return () => unsub()
    }, [diaKey])

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setErro(null)
        const cpf = cpfToDigits(cpfMasked)
        if (!nome.trim()) return setErro('Informe o nome.')
        if (cpf.length !== 11) return setErro('CPF deve ter 11 dígitos.')

        try {
            await addDoc(collection(db, 'atendimentos'), {
                nome: nome.trim(),
                cpf,
                servico,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                diaKey,
                criadoPor: user?.uid ?? 'unknown',
            })
            // limpa form
            setNome('')
            setCpfMasked('')
            setServico(SERVICES[0])
        } catch {
            setErro('Falha ao salvar. Tente novamente.')
        }
    }

    function beginEdit(id: string) {
        setEditingId(id)
    }
    async function saveInline(id: string, field: 'nome' | 'cpf' | 'servico', value: string) {
        const payload: any = { updatedAt: serverTimestamp() }
        if (field === 'cpf') {
            payload.cpf = cpfToDigits(value)
            if (payload.cpf.length !== 11) return // ignora salvar cpf inválido
        } else {
            payload[field] = value.trim()
        }
        await updateDoc(doc(db, 'atendimentos', id), payload)
        setEditingId(null)
    }

    return (
        <div style={{ maxWidth: 960, margin: '4vh auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <strong>Recepção — Secretaria de Assistência Social</strong>
                <div>
                    <span style={{ marginRight: 8, color: '#555' }}>{user?.email}</span>
                    <button onClick={() => logout()} style={{ padding: '6px 10px' }}>Sair</button>
                </div>
            </header>

            <section style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Novo atendimento</h2>
                <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
                    <label>Nome
                        <input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                            style={{ width: '100%', padding: 8 }}
                        />
                    </label>

                    <label>CPF
                        <input
                            value={cpfMasked}
                            onChange={(e) => setCpfMasked(maskCpfInput(e.target.value))}
                            inputMode="numeric"
                            required
                            placeholder="000.000.000-00"
                            style={{ width: '100%', padding: 8 }}
                        />
                    </label>

                    <label>Serviço
                        <select
                            value={servico}
                            onChange={(e) => setServico(e.target.value)}
                            style={{ width: '100%', padding: 8 }}
                        >
                            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </label>

                    {erro && <div style={{ color: 'crimson' }}>{erro}</div>}
                    <button type="submit" style={{ padding: 10 }}>Registrar</button>
                </form>
            </section>

            <section style={{ border: '1px solid #ddd', padding: 12 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Atendimentos de hoje ({diaKey})</h2>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 6 }}>Nome</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 6 }}>CPF</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 6 }}>Serviço</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 6 }}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id}>
                                <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                                    {editingId === it.id ? (
                                        <input
                                            defaultValue={it.nome}
                                            onBlur={(e) => saveInline(it.id!, 'nome', e.target.value)}
                                            style={{ width: '100%', padding: 6 }}
                                            autoFocus
                                        />
                                    ) : it.nome}
                                </td>

                                <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                                    {editingId === it.id ? (
                                        <input
                                            defaultValue={it.cpf}
                                            onBlur={(e) => saveInline(it.id!, 'cpf', e.target.value)}
                                            style={{ width: '100%', padding: 6 }}
                                        />
                                    ) : displayCpfMasked(it.cpf)}
                                </td>

                                <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                                    {editingId === it.id ? (
                                        <select
                                            defaultValue={it.servico}
                                            onChange={(e) => saveInline(it.id!, 'servico', e.target.value)}
                                            style={{ width: '100%', padding: 6 }}
                                        >
                                            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    ) : it.servico}
                                </td>

                                <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                                    {editingId === it.id ? (
                                        <em>Editando… (saia do campo para salvar)</em>
                                    ) : (
                                        <button onClick={() => beginEdit(it.id!)} style={{ padding: '6px 10px' }}>
                                            Editar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: 8, color: '#666' }}>Nenhum atendimento hoje.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    )
}

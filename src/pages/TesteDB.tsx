import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../auth/AuthContext'

export default function TesteDB() {
    const { user } = useAuth()
    const [status, setStatus] = useState<string>('')

    async function testar() {
        setStatus('gravando...')
        try {
            const ref = await addDoc(collection(db, 'atendimentos'), {
                nome: 'Teste DB',
                cpf: '00000000000',
                servico: 'Cadastro/Atualização CadÚnico',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                diaKey: new Date().toISOString().slice(0, 10),
                criadoPor: user?.uid ?? 'tester',
            })
            setStatus(`OK! doc id: ${ref.id}`)
        } catch (e: any) {
            setStatus(`ERRO: ${e?.message ?? e}`)
        }
    }

    return (
        <div style={{ maxWidth: 600, margin: '10vh auto', fontFamily: 'system-ui,sans-serif' }}>
            <h1>Teste Firestore</h1>
            <p>Usuário logado: {user?.email || '—'}</p>
            <button onClick={testar} style={{ padding: 10 }}>Gravar doc de teste</button>
            <p style={{ marginTop: 12 }}>{status}</p>
            <p style={{ color: '#666' }}>
                Dica: depois veja no Console Firebase &rarr; Firestore &rarr; coleção <code>atendimentos</code>.
            </p>
        </div>
    )
}

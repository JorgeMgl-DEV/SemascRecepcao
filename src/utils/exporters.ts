import * as XLSX from 'xlsx'

export function exportToCSV(filename: string, rows: any[]) {
    if (!rows.length) return
    const header = Object.keys(rows[0])
    const csv = [
        header.join(';'),
        ...rows.map(r => header.map(h => stringify(r[h])).join(';'))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.csv') ? filename : filename + '.csv'
    a.click()
    URL.revokeObjectURL(url)
}

export function exportToXLSX(filename: string, rows: any[]) {
    if (!rows.length) return
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx')
}

// NOVOS: exportar múltiplas abas (por dia / por hora / por serviço)
export function exportSummaryXLSX(filename: string, tabs: Record<string, any[]>) {
    const wb = XLSX.utils.book_new()
    for (const [sheetName, rows] of Object.entries(tabs)) {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Sem dados' }])
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)) // Excel limita nome em 31 chars
    }
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx')
}

function stringify(v: any) {
    if (v == null) return ''
    if (v instanceof Date) return v.toISOString()
    return String(v).replaceAll('\n', ' ').replaceAll(';', ',')
}

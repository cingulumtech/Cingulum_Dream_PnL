import * as XLSX from 'xlsx'
import { GL, GLTxn } from '../types'

function isBlank(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const s = v.trim()
    if (s === '' || s === '-') return 0
    const neg = /^\(.*\)$/.test(s)
    const cleaned = s.replace(/[(),$]/g, '')
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return 0
    return neg ? -n : n
  }
  return 0
}

function toISODate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // excel date serial
    const utcDays = Math.floor(v - 25569)
    const d = new Date(utcDays * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof v === 'string') {
    const s = v.trim()
    // accept 'YYYY-MM-DD' or 'DD/MM/YYYY'
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m1) return s
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m2) {
      const d = Number(m2[1])
      const m = Number(m2[2])
      const y = Number(m2[3])
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return ''
}

function isAccountHeaderRow(row: unknown[]): boolean {
  // In your export, account header is in column A, with the rest blank.
  const a = row[0]
  if (typeof a !== 'string') return false
  const s = a.trim()
  if (!s) return false
  if (/^total\s+/i.test(s) || s.toLowerCase() === 'net movement') return false
  // header rows have no date in col A; but here date shares col A too.
  // we treat it as header if col B.. are all blank.
  const restBlank = row.slice(1, 6).every(isBlank)
  return restBlank
}

export function parseXeroGeneralLedgerDetail(file: ArrayBuffer): GL {
  const wb = XLSX.read(file, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  // find header row (Date / Source / Description...)
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const row = rows[i] ?? []
    if (row.some(v => typeof v === 'string' && v.trim().toLowerCase() === 'date')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) throw new Error('Could not find GL header row (Date).')

  // map column indexes
  const header = rows[headerIdx].map(v => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
  const idx = (name: string) => header.findIndex(h => h === name)
  const dateCol = idx('date')
  const sourceCol = idx('source')
  const descCol = idx('description')
  const refCol = idx('reference')
  const debitCol = idx('debit')
  const creditCol = idx('credit')

  const txns: GLTxn[] = []
  let currentAccount = ''

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    if (row.every(isBlank)) continue

    // account header rows
    if (isAccountHeaderRow(row)) {
      currentAccount = String(row[0]).trim()
      continue
    }
    if (!currentAccount) continue

    const first = row[0]
    if (typeof first === 'string') {
      const s = first.trim()
      if (/^total\s+/i.test(s) || s.toLowerCase() === 'net movement') continue
    }

    const date = toISODate(row[dateCol])
    if (!date) continue

    const debit = toNumber(row[debitCol])
    const credit = toNumber(row[creditCol])
    const amount = debit - credit

    txns.push({
      account: currentAccount,
      date,
      source: sourceCol >= 0 ? String(row[sourceCol] ?? '').trim() : undefined,
      description: descCol >= 0 ? String(row[descCol] ?? '').trim() : undefined,
      reference: refCol >= 0 ? String(row[refCol] ?? '').trim() : undefined,
      debit,
      credit,
      amount,
    })
  }

  return { txns }
}

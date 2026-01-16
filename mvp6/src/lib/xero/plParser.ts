import * as XLSX from 'xlsx'
import { MonthKey, XeroPL, XeroPLAccount, XeroPLSection } from '../types'

function isBlank(v: unknown) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const s = v.trim()
    if (s === '' || s === '-') return 0
    // handle parentheses negatives, currency, commas
    const neg = /^\(.*\)$/.test(s)
    const cleaned = s.replace(/[(),$]/g, '')
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return 0
    return neg ? -n : n
  }
  return 0
}

function excelDateToJSDate(serial: number): Date {
  // XLSX uses 1900 date system by default
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  return new Date(utcValue * 1000)
}

function normalizeMonthLabel(v: unknown): { key: MonthKey; label: string } | null {
  if (isBlank(v)) return null
  if (typeof v === 'number') {
    const d = excelDateToJSDate(v)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = d.toLocaleString('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    return { key, label }
  }
  if (typeof v === 'string') {
    // Xero: "Dec 2025" or "Sept 2025"
    const s = v.trim()
    const m = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
    if (m) {
      const monthName = m[1].toLowerCase()
      const year = Number(m[2])
      const map: Record<string, number> = {
        jan: 1, january: 1,
        feb: 2, february: 2,
        mar: 3, march: 3,
        apr: 4, april: 4,
        may: 5,
        jun: 6, june: 6,
        jul: 7, july: 7,
        aug: 8, august: 8,
        sep: 9, sept: 9, september: 9,
        oct: 10, october: 10,
        nov: 11, november: 11,
        dec: 12, december: 12,
      }
      const mn = map[monthName] ?? map[monthName.slice(0, 3)]
      if (mn) {
        const key = `${year}-${String(mn).padStart(2, '0')}`
        const label = new Date(Date.UTC(year, mn - 1, 1)).toLocaleString('en-AU', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
        return { key, label }
      }
    }
    const dateMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (dateMatch) {
      const month = Number(dateMatch[1])
      const yearRaw = Number(dateMatch[3])
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
      if (month >= 1 && month <= 12) {
        const key = `${year}-${String(month).padStart(2, '0')}`
        const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-AU', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
        return { key, label }
      }
    }
    // fallback: return raw string as label (still stable key via value)
    return { key: s, label: s }
  }
  return null
}

function sectionFromHeader(label: string): XeroPLSection {
  const s = label.trim().toLowerCase()
  if (s.includes('trading income')) return 'trading_income'
  if (s.includes('cost of sales') || s.includes('costs of sales') || s.includes('cogs')) return 'cost_of_sales'
  if (s.includes('other income')) return 'other_income'
  if (s.includes('operating expenses')) return 'operating_expenses'
  return 'unknown'
}

function isSectionHeaderRow(a: unknown, rest: unknown[]): boolean {
  if (typeof a !== 'string') return false
  if (a.trim() === '') return false
  const hasAnyNumber = rest.some(v => typeof v === 'number' && v !== 0)
  const hasAnyTextInRest = rest.some(v => typeof v === 'string' && v.trim() !== '')
  // section headers in Xero export tend to have only col A populated
  return !hasAnyNumber && !hasAnyTextInRest
}

function isTotalRow(a: unknown): boolean {
  return typeof a === 'string' && /^total\s+/i.test(a.trim())
}

function isSummaryRow(a: unknown): boolean {
  if (typeof a !== 'string') return false
  const s = a.trim().toLowerCase()
  // Xero P&L exports often include presentation-summary rows (e.g., "Net Profit").
  // These must NOT be treated as normal accounts, otherwise totals (and net profit) get corrupted.
  return (
    s === 'net profit' ||
    s === 'net income' ||
    s === 'gross profit' ||
    s === 'gross margin' ||
    s === 'operating profit' ||
    s === 'operating income'
  )
}

export function parseXeroProfitAndLoss(file: ArrayBuffer): XeroPL {
  const wb = XLSX.read(file, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })

  // 1) find header row containing "Account"
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 250); i++) {
    const row = rows[i] ?? []
    const first = row[0]
    if (typeof first === 'string' && first.trim().toLowerCase() === 'account') {
      headerIdx = i
      break
    }
    if (row.some(v => typeof v === 'string' && v.trim().toLowerCase() === 'account')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) throw new Error('Could not find header row (Account).')

  const header = rows[headerIdx] ?? []
  // 2) month columns are positional: col0 is account, last col is total (even if blank)
  const totalCol = Math.max(1, header.length - 1)
  const monthStartCol = 1
  const monthEndColExclusive = totalCol // exclude last col
  const monthCount = Math.max(0, monthEndColExclusive - monthStartCol)

  const months: MonthKey[] = []
  const monthLabels: string[] = []
  for (let c = monthStartCol; c < monthStartCol + monthCount; c++) {
    const normalized = normalizeMonthLabel(header[c])
    if (normalized) {
      months.push(normalized.key)
      monthLabels.push(normalized.label)
    } else {
      months.push(`col_${c}`)
      monthLabels.push(`Col ${c}`)
    }
  }

  // 3) walk data rows
  const accounts: XeroPLAccount[] = []
  let section: XeroPLSection = 'unknown'

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const a = row[0]
    const rest = row.slice(1, 1 + monthCount)

    if (isBlank(a) && rest.every(isBlank)) continue
    if (isTotalRow(a) || isSummaryRow(a)) continue

    if (isSectionHeaderRow(a, rest)) {
      section = sectionFromHeader(String(a))
      continue
    }

    if (typeof a === 'string') {
      const name = a.trim()
      if (!name) continue

      const values = rest.map(toNumber)
      const total = toNumber(row[1 + monthCount])

      // if it's clearly a spacer, skip
      const anyNonBlank = rest.some(v => !isBlank(v))
      const anyNonZero = values.some(v => v !== 0)
      if (!anyNonBlank && !anyNonZero) continue

      accounts.push({
        name,
        section,
        values: values.slice(0, months.length).concat(Array(Math.max(0, months.length - values.length)).fill(0)),
        total,
      })
    }
  }

  return { months, monthLabels, accounts }
}

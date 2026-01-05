import { XeroPL } from './types'
import { computeXeroTotals } from './dream/compute'

function parseMonth(key: string): { year: number; month: number } | null {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return null
  if (m < 1 || m > 12) return null
  return { year: y, month: m }
}

function addMonths(start: { year: number; month: number }, delta: number) {
  const d = new Date(Date.UTC(start.year, start.month - 1 + delta, 1))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function labelMonth(val: { year: number; month: number }) {
  return new Date(Date.UTC(val.year, val.month - 1, 1)).toLocaleString('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export type DataHealthSummary = {
  monthsDetected: number
  rangeLabel: string
  gaps: string[]
  anomalies: string[]
}

export function analyzeDataHealth(pl: XeroPL): DataHealthSummary {
  const monthsDetected = pl.months.length
  const parsed = pl.months.map(parseMonth)
  const validMonths = parsed.filter(Boolean) as { year: number; month: number }[]

  const rangeLabel =
    validMonths.length > 1
      ? `${labelMonth(validMonths[0])} → ${labelMonth(validMonths[validMonths.length - 1])}`
      : pl.monthLabels[0] ?? '—'

  const gaps: string[] = []
  for (let i = 0; i < validMonths.length - 1; i++) {
    const cur = validMonths[i]
    const next = validMonths[i + 1]
    const diff = (next.year - cur.year) * 12 + (next.month - cur.month)
    if (diff > 1) {
      const missing: string[] = []
      for (let step = 1; step < diff; step++) {
        missing.push(labelMonth(addMonths(cur, step)))
      }
      gaps.push(`${labelMonth(cur)} → ${labelMonth(next)} (${missing.length} month gap${missing.length > 1 ? 's' : ''})`)
    }
  }

  const anomalies: string[] = []
  if (new Set(pl.months).size !== pl.months.length) {
    anomalies.push('Duplicate month columns detected')
  }

  const mismatched = pl.accounts.filter(a => a.values.length !== pl.months.length)
  if (mismatched.length) {
    anomalies.push(`${mismatched.length} accounts had missing month values (padded)`)
  }

  const totals = computeXeroTotals(pl)
  const quietMonths: string[] = []
  for (let i = 0; i < pl.months.length; i++) {
    const isZero = (totals.revenue[i] ?? 0) === 0 && (totals.cogs[i] ?? 0) === 0 && (totals.opex[i] ?? 0) === 0
    if (isZero) quietMonths.push(pl.monthLabels[i] ?? `Month ${i + 1}`)
  }
  if (quietMonths.length) {
    anomalies.push(`No activity detected for ${quietMonths.slice(0, 4).join(', ')}${quietMonths.length > 4 ? '…' : ''}`)
  }

  return {
    monthsDetected,
    rangeLabel,
    gaps,
    anomalies,
  }
}

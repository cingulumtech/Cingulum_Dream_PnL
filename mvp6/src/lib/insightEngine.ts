import { XeroPL } from './types'

export type Insight = { title: string; detail: string }

export function computeVarianceInsights(current?: number[], scenario?: number[]): Insight[] {
  if (!current || !scenario || !current.length || !scenario.length) return [{ title: 'Data quality', detail: 'Scenario overlay is off or missing. Turn scenario on to see variance insights.' }]
  const delta = scenario.reduce((a, b) => a + (b ?? 0), 0) - current.reduce((a, b) => a + (b ?? 0), 0)
  const direction = delta >= 0 ? 'uplift' : 'decline'
  const magnitude = Math.abs(delta)
  return [{ title: 'Variance', detail: `Scenario shows a ${direction} of ${format(magnitude)} across the modeled period.` }]
}

export function computeTrendInsights(series?: number[]): Insight[] {
  if (!series || series.length < 6) return [{ title: 'Not enough history', detail: 'Upload more history to unlock trend insights.' }]
  const last3 = mean(series.slice(-3))
  const prev3 = mean(series.slice(-6, -3))
  const dir = last3 >= prev3 ? 'improving' : 'softening'
  const pct = prev3 === 0 ? 0 : ((last3 - prev3) / Math.abs(prev3)) * 100
  return [{ title: 'Trend', detail: `Last 3 months are ${dir} vs prior 3 (${pct.toFixed(1)}%).` }]
}

export function computeAnomalyInsights(series?: number[], labels?: string[]): Insight[] {
  if (!series || series.length < 6) return []
  const m = mean(series)
  const sd = Math.sqrt(mean(series.map(v => (v - m) ** 2)))
  const anomalies: Insight[] = []
  series.forEach((v, i) => {
    if (Math.abs(v - m) > 1.5 * sd) {
      anomalies.push({ title: 'Anomaly', detail: `${labels?.[i] ?? `Month ${i + 1}`}: ${format(v)} vs avg ${format(m)}.` })
    }
  })
  return anomalies.slice(0, 3)
}

export function computeDataQuality(pl?: XeroPL | null): Insight[] {
  if (!pl) return [{ title: 'Missing data', detail: 'Upload a P&L to generate insights.' }]
  const mappedAccounts = pl.accounts?.length ?? 0
  const missing = mappedAccounts === 0
  if (missing) return [{ title: 'Mapping needed', detail: 'No accounts mapped yet. Complete mapping to unlock drivers.' }]
  return [{ title: 'Data quality', detail: `${mappedAccounts} accounts loaded. Ensure key revenue/COGS/opex are mapped for best fidelity.` }]
}

function mean(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function format(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

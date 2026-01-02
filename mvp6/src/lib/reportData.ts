import { applyBundledScenario, computeDepAmort, computeDream, computeDreamTotals, computeXeroTotals, DreamTotals, findGroup } from './dream/compute'
import { DreamGroup, DreamLine, DreamTemplate, ScenarioInputs, XeroPL } from './types'

export type DataSource = 'legacy' | 'dream'

export type DriverItem = {
  label: string
  delta: number
  contributionPct: number
}

export type DriverResult = {
  items: DriverItem[]
  disabledReason?: string
  diagnostics?: string[]
  suspicious?: boolean
}

export type TrendStats = {
  last3vsPrev3?: string
  volatility?: string
}

export type VarianceAttribution = {
  label: string
  amount: number
  tone?: 'good' | 'bad'
}

export type DataQuality = {
  mappingCompleteness: number
  missingAccounts: string[]
  missingKeyAccounts: string[]
  disabledSections: string[]
  warnings: string[]
}

export type ReportData = {
  dataSourceRequested: DataSource
  dataSourceUsed: DataSource
  fallbackReason?: string
  recommendedSource: DataSource
  periodLabel: string
  dataSourceLabel: string
  dataQualityBadge: string
  baseTotals: DreamTotals | null
  scenarioTotals: DreamTotals | null
  trendRows: { month: string; current: number; scenario?: number | null }[]
  trendStats: TrendStats
  kpis: { label: string; current: number; scenario?: number | null; variance?: number | null; tone?: 'good' | 'bad' }[]
  executiveSummary: string[]
  whatChanged: string[]
  varianceAttribution?: VarianceAttribution[]
  drivers: {
    revenue: DriverResult
    cost: DriverResult
  }
  pnlSummary: { label: string; current: number; scenario?: number | null; variance?: number | null; tone?: 'good' | 'bad' }[]
  dataQuality: DataQuality
  scenarioNotes: string[]
}

const MONEY_FORMATTER = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

function money(n: number) {
  return MONEY_FORMATTER.format(n)
}

function flattenLinesWithSection(root: DreamGroup, parentSection: 'rev' | 'cogs' | 'opex' | null = null): { line: DreamLine; section: 'rev' | 'cogs' | 'opex' | null }[] {
  let section: 'rev' | 'cogs' | 'opex' | null = parentSection
  if (root.id === 'rev' || root.id === 'cogs' || root.id === 'opex') section = root.id
  const out: { line: DreamLine; section: 'rev' | 'cogs' | 'opex' | null }[] = []
  for (const child of root.children) {
    if (child.kind === 'line') out.push({ line: child, section })
    else out.push(...flattenLinesWithSection(child, section))
  }
  return out
}

function calcMappingStats(pl: XeroPL | null, template: DreamTemplate): {
  completeness: number
  missingAccounts: string[]
  missingKeyAccounts: string[]
  mappedAccounts: Set<string>
} {
  if (!pl) return { completeness: 0, missingAccounts: [], missingKeyAccounts: [], mappedAccounts: new Set() }
  const mappedAccounts = new Set<string>()
  const lines = flattenLinesWithSection(template.root)
  for (const ln of lines) for (const acc of ln.line.mappedAccounts) mappedAccounts.add(acc)

  let absMapped = 0
  let absTotal = 0
  const missing: string[] = []
  const missingKey: string[] = []
  for (const acc of pl.accounts) {
    const totalAbs = Math.abs(acc.total ?? acc.values.reduce((a, b) => a + (b ?? 0), 0))
    absTotal += totalAbs
    if (!mappedAccounts.has(acc.name)) {
      missing.push(acc.name)
      if (isKeyAccount(acc)) missingKey.push(acc.name)
    } else {
      absMapped += totalAbs
    }
  }

  const completeness = absTotal === 0 ? 0 : absMapped / absTotal
  return { completeness, missingAccounts: missing, missingKeyAccounts: missingKey, mappedAccounts }
}

function isKeyAccount(acc: { section: string; total: number }) {
  return (
    ['trading_income', 'other_income', 'cost_of_sales', 'operating_expenses'].includes(acc.section) &&
    Math.abs(acc.total ?? 0) > 0
  )
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + (b ?? 0), 0) / arr.length
}

function last3vsPrev3(values: number[]): { delta: number; prev: number } | null {
  if (!values || values.length < 6) return null
  const last3 = avg(values.slice(-3))
  const prev3 = avg(values.slice(-6, -3))
  return { delta: last3 - prev3, prev: prev3 }
}

function volatility(values: number[]) {
  if (!values.length) return 0
  const mean = avg(values)
  const variance = avg(values.map(v => (v - mean) ** 2))
  return Math.sqrt(variance)
}

function driverFromSeries(entries: { label: string; values: number[] }[], disabledReason?: string): DriverResult {
  if (disabledReason) return { items: [], disabledReason }
  if (!entries.length) return { items: [], disabledReason: 'No data available.' }
  if (entries.every(e => e.values.length < 6)) return { items: [], disabledReason: 'Need at least 6 months of data for drivers.' }

  const deltas = entries
    .map(e => ({ label: e.label, delta: sum(e.values.slice(-3)) - sum(e.values.slice(-6, -3)) }))
    .filter(e => !Number.isNaN(e.delta))

  const sorted = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const top = sorted.filter(e => Math.abs(e.delta) > 0).slice(0, 5)
  if (!top.length) return { items: [], disabledReason: 'Not enough movement to rank drivers.' }

  const absValues = top.map(t => Math.abs(t.delta))
  const varianceSpan = Math.max(...absValues) - Math.min(...absValues)
  const suspicious = absValues.length >= 2 && varianceSpan < 1
  const denom = absValues.reduce((a, b) => a + b, 0) || 1

  return {
    items: top.map(t => ({ label: t.label, delta: t.delta, contributionPct: (Math.abs(t.delta) / denom) * 100 })),
    suspicious,
  }
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (b ?? 0), 0)
}

function buildVarianceAttribution(base: DreamTotals, scenarioTotals: DreamTotals): VarianceAttribution[] {
  const revenueDelta = sum(scenarioTotals.revenue) - sum(base.revenue)
  const cogsDelta = sum(scenarioTotals.cogs) - sum(base.cogs)
  const opexDelta = sum(scenarioTotals.opex) - sum(base.opex)
  const netDelta = sum(scenarioTotals.net) - sum(base.net)
  const unattributed = netDelta - (revenueDelta - cogsDelta - opexDelta)

  const attribution: VarianceAttribution[] = [
    { label: 'Volume & pricing uplift', amount: revenueDelta, tone: revenueDelta >= 0 ? 'good' : 'bad' },
    { label: 'Bundle & consult costs', amount: -cogsDelta, tone: cogsDelta <= 0 ? 'good' : 'bad' },
    { label: 'Opex levers (rent/efficiency)', amount: -opexDelta, tone: opexDelta <= 0 ? 'good' : 'bad' },
  ]

  if (Math.abs(unattributed) > 1) {
    attribution.push({ label: 'Unattributed / rounding', amount: unattributed })
  }
  return attribution
}

function describeScenario(scenario: ScenarioInputs): string[] {
  const notes: string[] = []
  notes.push(`Pricing: $${scenario.cbaPrice ?? 0} CBA, $${scenario.programPrice ?? 0} cgTMS; State ${scenario.state}`)
  notes.push(`Volume: ${scenario.cbaMonthlyCount ?? 0} CBA / ${scenario.programMonthlyCount ?? 0} cgTMS per month${scenario.machinesEnabled ? ' (machine capacity applied)' : ''}`)
  notes.push(`Consult treatment: ${scenario.includeDoctorConsultsInBundle ? 'consults removed from legacy revenue' : 'consults left in legacy revenue'}`)
  notes.push(`Bundle costs ${scenario.addBundleCostsToScenario ? 'included' : 'excluded'}; Doctor service fee ${scenario.doctorServiceFeePct ?? 0}% share`)
  return notes
}

function formatWhatChanged(label: string, delta: number, prev: number) {
  const direction = delta >= 0 ? 'up' : 'down'
  const pct = prev === 0 ? 0 : (delta / Math.abs(prev)) * 100
  return `${label} ${direction} ${money(delta)} vs prior 3 months (${pct.toFixed(1)}%).`
}

export function getReportData(opts: {
  dataSource: DataSource
  pl: XeroPL | null
  template: DreamTemplate
  scenario: ScenarioInputs
  includeScenario: boolean
  completenessThreshold?: number
}): ReportData {
  const { dataSource, pl, template, scenario, includeScenario, completenessThreshold = 0.85 } = opts
  const mapping = calcMappingStats(pl, template)
  const recommendedSource: DataSource = mapping.completeness >= completenessThreshold ? 'dream' : 'legacy'

  const buildForSource = (source: DataSource): ReportData => {
    const hasData = !!pl
    if (!hasData) {
      return {
        dataSourceRequested: dataSource,
        dataSourceUsed: source,
        recommendedSource,
        fallbackReason: 'No P&L uploaded.',
        periodLabel: 'Upload a P&L export to begin.',
        dataSourceLabel: 'No data',
        dataQualityBadge: 'Missing data',
        baseTotals: null,
        scenarioTotals: null,
        trendRows: [],
        trendStats: {},
        kpis: [],
        executiveSummary: ['Upload a P&L export to generate a report.'],
        whatChanged: [],
        varianceAttribution: undefined,
        drivers: { revenue: { items: [], disabledReason: 'No data uploaded.' }, cost: { items: [], disabledReason: 'No data uploaded.' } },
        pnlSummary: [],
        dataQuality: {
          mappingCompleteness: mapping.completeness,
          missingAccounts: mapping.missingAccounts,
          missingKeyAccounts: mapping.missingKeyAccounts,
          disabledSections: ['trend', 'drivers', 'pnl', 'waterfall'],
          warnings: ['Upload a P&L export to enable reporting.'],
        },
        scenarioNotes: describeScenario(scenario),
      }
    }

    const months = pl.monthLabels
    let baseTotals: DreamTotals
    let computedDream: ReturnType<typeof computeDream> | null = null
    let completenessWarnings: string[] = []
    if (source === 'dream') {
      computedDream = computeDream(pl, template)
      baseTotals = computeDreamTotals(pl, template, computedDream)
      if (mapping.completeness < completenessThreshold) {
        completenessWarnings.push('Dream mapping below 85%. Some sections disabled.')
      }
    } else {
      baseTotals = computeXeroTotals(pl)
    }

    const scenarioActive = includeScenario && scenario.enabled
    const scenarioTotals = scenarioActive ? applyBundledScenario(baseTotals, pl, scenario) : null

    const depAmort = computeDepAmort(pl)
    const ebitdaCurrent = baseTotals.net.map((v, i) => v + (depAmort?.[i] ?? 0))
    const ebitdaScenario = scenarioTotals ? scenarioTotals.net.map((v, i) => v + (depAmort?.[i] ?? 0)) : null

    const lastMonthLabel = months[months.length - 1] ?? 'Current period'
    const periodLabel = `Through ${lastMonthLabel}`

    const netDelta = scenarioTotals ? sum(scenarioTotals.net) - sum(baseTotals.net) : null

    const kpis = [
      { label: 'TTM net profit', current: sum(baseTotals.net), scenario: scenarioTotals ? sum(scenarioTotals.net) : null, variance: netDelta, tone: netDelta != null ? (netDelta >= 0 ? 'good' : 'bad') : undefined },
      { label: 'Avg monthly profit', current: avg(baseTotals.net) },
      { label: 'Gross margin', current: avg(baseTotals.revenue) === 0 ? 0 : ((avg(baseTotals.revenue) - avg(baseTotals.cogs)) / Math.max(1, Math.abs(avg(baseTotals.revenue)))) * 100 },
      { label: 'EBITDA (est.)', current: sum(ebitdaCurrent), scenario: ebitdaScenario ? sum(ebitdaScenario) : null, variance: ebitdaScenario ? sum(ebitdaScenario) - sum(ebitdaCurrent) : null },
    ]

    const netChange = last3vsPrev3(baseTotals.net)
    const revChange = last3vsPrev3(baseTotals.revenue)
    const gmChange = last3vsPrev3(baseTotals.revenue.map((r, i) => r - (baseTotals.cogs[i] ?? 0)))
    const opexChange = last3vsPrev3(baseTotals.opex)

    const whatChanged: string[] = []
    if (netChange) whatChanged.push(formatWhatChanged('Net profit', netChange.delta, netChange.prev))
    if (revChange) whatChanged.push(formatWhatChanged('Revenue', revChange.delta, revChange.prev))
    if (gmChange) whatChanged.push(formatWhatChanged('Gross margin', gmChange.delta, gmChange.prev))
    if (opexChange) whatChanged.push(formatWhatChanged('Opex', opexChange.delta, opexChange.prev))
    if (!whatChanged.length) whatChanged.push('Not enough history (need 6+ months) to explain recent movements.')

    const trendStats: TrendStats = {}
    if (netChange) trendStats.last3vsPrev3 = formatWhatChanged('Net profit', netChange.delta, netChange.prev)
    const vol = volatility(baseTotals.net)
    if (!Number.isNaN(vol)) trendStats.volatility = `${vol.toFixed(0)} std-dev`

    const trendRows = months.map((m, i) => ({ month: m, current: baseTotals.net[i] ?? 0, scenario: scenarioTotals ? scenarioTotals.net[i] ?? null : null }))

    const driverDisabled = source === 'dream' && mapping.completeness < completenessThreshold
      ? 'Not enough mapped data (need 85% of key accounts).'
      : undefined

    const revenueEntries = source === 'dream'
      ? flattenLinesWithSection(template.root)
          .filter(l => l.section === 'rev')
          .map(l => ({ label: l.line.label, values: computedDream?.byLineId[l.line.id] ?? Array(pl.months.length).fill(0) }))
      : pl.accounts.filter(a => a.section === 'trading_income' || a.section === 'other_income').map(a => ({ label: a.name, values: a.values }))

    const costEntries = source === 'dream'
      ? flattenLinesWithSection(template.root)
          .filter(l => l.section === 'cogs' || l.section === 'opex')
          .map(l => ({ label: l.line.label, values: computedDream?.byLineId[l.line.id] ?? Array(pl.months.length).fill(0) }))
      : pl.accounts
          .filter(a => a.section === 'cost_of_sales' || a.section === 'operating_expenses')
          .map(a => ({ label: a.name, values: a.values }))

    const revenueDrivers = driverFromSeries(revenueEntries, driverDisabled)
    const costDrivers = driverFromSeries(costEntries, driverDisabled)

    const pnlSummary = [
      { label: 'Revenue', current: sum(baseTotals.revenue), scenario: scenarioTotals ? sum(scenarioTotals.revenue) : null, variance: scenarioTotals ? sum(scenarioTotals.revenue) - sum(baseTotals.revenue) : null },
      { label: 'COGS', current: sum(baseTotals.cogs), scenario: scenarioTotals ? sum(scenarioTotals.cogs) : null, variance: scenarioTotals ? sum(scenarioTotals.cogs) - sum(baseTotals.cogs) : null, tone: scenarioTotals ? (sum(scenarioTotals.cogs) - sum(baseTotals.cogs) <= 0 ? 'good' : 'bad') : undefined },
      { label: 'Gross profit', current: sum(baseTotals.revenue) - sum(baseTotals.cogs), scenario: scenarioTotals ? sum(scenarioTotals.revenue) - sum(scenarioTotals.cogs) : null, variance: scenarioTotals ? (sum(scenarioTotals.revenue) - sum(scenarioTotals.cogs)) - (sum(baseTotals.revenue) - sum(baseTotals.cogs)) : null },
      { label: 'Opex', current: sum(baseTotals.opex), scenario: scenarioTotals ? sum(scenarioTotals.opex) : null, variance: scenarioTotals ? sum(scenarioTotals.opex) - sum(baseTotals.opex) : null, tone: scenarioTotals ? (sum(scenarioTotals.opex) - sum(baseTotals.opex) <= 0 ? 'good' : 'bad') : undefined },
      { label: 'EBITDA (est.)', current: sum(ebitdaCurrent), scenario: ebitdaScenario ? sum(ebitdaScenario) : null, variance: ebitdaScenario ? sum(ebitdaScenario) - sum(ebitdaCurrent) : null },
      { label: 'Net profit', current: sum(baseTotals.net), scenario: scenarioTotals ? sum(scenarioTotals.net) : null, variance: netDelta },
    ]

    const executiveSummary: string[] = []
    executiveSummary.push(`Datasource: ${source === 'dream' ? 'Dream P&L (mapped model)' : 'Legacy Xero export'}`)
    if (netDelta != null) executiveSummary.push(`Scenario impact: ${money(netDelta)} vs current.`)
    executiveSummary.push(...whatChanged.slice(0, 3))
    const topMoverSentences = [...revenueDrivers.items, ...costDrivers.items]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map(d => `${d.label} (${money(d.delta)}; ${d.contributionPct.toFixed(1)}% of movement)`)
    if (topMoverSentences.length) executiveSummary.push(`Top movement drivers: ${topMoverSentences.join(' • ')}`)

    const dataQuality: DataQuality = {
      mappingCompleteness: mapping.completeness,
      missingAccounts: mapping.missingAccounts,
      missingKeyAccounts: mapping.missingKeyAccounts,
      disabledSections: [],
      warnings: [...completenessWarnings],
    }

    if (driverDisabled) dataQuality.disabledSections.push('drivers')
    if (scenarioActive && mapping.completeness < completenessThreshold && source === 'dream') dataQuality.disabledSections.push('waterfall')

    const dataSourceLabel = source === 'dream' ? 'Dream P&L (mapped model)' : 'Legacy P&L (Xero export)'
    const dataQualityBadge = source === 'dream' ? `${Math.round(mapping.completeness * 100)}% mapped` : 'Legacy source'

    const varianceAttribution = scenarioTotals ? buildVarianceAttribution(baseTotals, scenarioTotals) : undefined

    const drivers = {
      revenue: revenueDrivers,
      cost: costDrivers,
    }

    return {
      dataSourceRequested: dataSource,
      dataSourceUsed: source,
      recommendedSource,
      fallbackReason: undefined,
      periodLabel,
      dataSourceLabel,
      dataQualityBadge,
      baseTotals,
      scenarioTotals,
      trendRows,
      trendStats,
      kpis,
      executiveSummary,
      whatChanged,
      varianceAttribution,
      drivers,
      pnlSummary,
      dataQuality,
      scenarioNotes: describeScenario(scenario),
    }
  }

  let report = buildForSource(dataSource)
  const fallbackEligible =
    dataSource === 'dream' &&
    pl &&
    (report.drivers.revenue.suspicious || report.drivers.cost.suspicious)
  if (fallbackEligible) {
    const legacyReport = buildForSource('legacy')
    report = { ...legacyReport, dataSourceRequested: dataSource, dataSourceUsed: 'legacy', fallbackReason: 'Dream drivers looked identical. Fell back to Legacy data.' }
  }

  return report
}

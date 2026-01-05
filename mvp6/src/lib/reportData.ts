import { applyBundledScenario, computeDepAmort, computeDream, computeDreamTotals, computeXeroTotals, DreamTotals } from './dream/compute'
import { DreamGroup, DreamLine, DreamTemplate, ScenarioInputs, XeroPL } from './types'

export type DataSource = 'legacy' | 'dream'
export type ComparisonMode = 'last3_vs_prev3' | 'scenario_vs_current' | 'month_vs_prior'

export type DriverItem = {
  label: string
  sectionType: 'income' | 'expense'
  currentValue: number | null
  compareValue: number | null
  delta: number | null
  pctDelta: number | null
  contributionPct: number
  profitImpact: number | null
  note?: string
}

export type DriverResult = {
  items: DriverItem[]
  disabledReason?: string
  diagnostics?: string[]
  suspicious?: boolean
}

export type TrendStats = {
  last3vsPrev3?: string
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
  dataQualityBadgeLabel: string
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
  comparisonMode: ComparisonMode
  comparisonLabel: string
  movementBadge: string
}

const MONEY_FORMATTER = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

function money(n: number) {
  return MONEY_FORMATTER.format(n)
}

function pct(num: number | null | undefined) {
  if (num == null || Number.isNaN(num)) return '—'
  return `${num.toFixed(1)}%`
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

function last3vsPrev3(values: number[]): { currentTotal: number; compareTotal: number } | null {
  if (!values || values.length < 6) return null
  const currentTotal = sum(values.slice(-3))
  const compareTotal = sum(values.slice(-6, -3))
  return { currentTotal, compareTotal }
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

function computeComparison(mode: ComparisonMode, currentSeries: number[], compareSeries: number[], scenarioTotals?: DreamTotals | null): { currentTotal: number | null; compareTotal: number | null; delta: number | null; pctDelta: number | null; label: string } {
  if (mode === 'scenario_vs_current') {
    if (!scenarioTotals) return { currentTotal: null, compareTotal: null, delta: null, pctDelta: null, label: 'Scenario TTM – Current TTM' }
    const currentTotal = sum(compareSeries)
    const compareTotal = sum(currentSeries)
    const delta = currentTotal - compareTotal
    const pctDelta = compareTotal === 0 ? null : (delta / Math.abs(compareTotal)) * 100
    return { currentTotal, compareTotal, delta, pctDelta, label: 'Scenario TTM – Current TTM' }
  }
  if (mode === 'month_vs_prior') {
    if (currentSeries.length < 2) return { currentTotal: null, compareTotal: null, delta: null, pctDelta: null, label: 'Last month vs prior month' }
    const currentTotal = currentSeries[currentSeries.length - 1] ?? 0
    const compareTotal = currentSeries[currentSeries.length - 2] ?? 0
    const delta = currentTotal - compareTotal
    const pctDelta = compareTotal === 0 ? null : (delta / Math.abs(compareTotal)) * 100
    return { currentTotal, compareTotal, delta, pctDelta, label: 'Last month vs prior month' }
  }
  const window = last3vsPrev3(currentSeries)
  if (!window) return { currentTotal: null, compareTotal: null, delta: null, pctDelta: null, label: 'Last 3 months vs prior 3 months' }
  const delta = window.currentTotal - window.compareTotal
  const pctDelta = window.compareTotal === 0 ? null : (delta / Math.abs(window.compareTotal)) * 100
  return { currentTotal: window.currentTotal, compareTotal: window.compareTotal, delta, pctDelta, label: 'Last 3 months vs prior 3 months' }
}

function makeDataQualityBadge(source: DataSource, completeness: number, missingKeyCount: number): { badge: string; level: 'good' | 'partial' | 'bad' } {
  if (source === 'legacy') return { badge: 'Data quality: Legacy (Good)', level: 'good' }
  if (completeness >= 0.85) return { badge: 'Data quality: Good', level: 'good' }
  if (completeness >= 0.5) return { badge: `Data quality: Partial (${Math.round(completeness * 100)}% mapped; missing ${missingKeyCount} key)`, level: 'partial' }
  return { badge: `Data quality: Incomplete (${Math.round(completeness * 100)}% mapped; missing ${missingKeyCount} key)`, level: 'bad' }
}

function getDrivers(opts: {
  entries: { label: string; values: number[]; sectionType: 'income' | 'expense' }[]
  mode: ComparisonMode
  scenarioTotals: DreamTotals | null
  scenarioEntries?: { label: string; values: number[]; sectionType: 'income' | 'expense' }[]
}): DriverResult {
  const { entries, mode, scenarioTotals, scenarioEntries } = opts
  if (!entries.length) return { items: [], disabledReason: 'Not enough mapped data to show drivers.' }
  if (mode === 'last3_vs_prev3' && entries.every(e => e.values.length < 6)) return { items: [], disabledReason: 'Need at least 6 months of data for drivers.' }

  const deltas = entries.map((e, idx) => {
    const compareSeries = mode === 'scenario_vs_current' && scenarioEntries?.[idx] ? scenarioEntries[idx].values : e.values
    const cmp = computeComparison(mode, e.values, compareSeries, scenarioTotals)
    const polarity = e.sectionType === 'income' ? 1 : -1
    const profitImpact = cmp.delta == null ? null : cmp.delta * polarity
    return {
      label: e.label,
      sectionType: e.sectionType,
      currentValue: cmp.currentTotal,
      compareValue: cmp.compareTotal,
      delta: cmp.delta,
      pctDelta: cmp.pctDelta,
      profitImpact,
    }
  })

  const deltasFiltered = deltas.filter(d => d.delta != null)
  const sorted = deltasFiltered.sort((a, b) => Math.abs((b.delta ?? 0)) - Math.abs((a.delta ?? 0)))
  const top = sorted.filter(d => Math.abs(d.delta ?? 0) > 0).slice(0, 5)
  if (!top.length) return { items: [], disabledReason: 'Not enough movement to rank drivers.' }

  const absValues = top.map(t => Math.abs(t.delta ?? 0))
  const varianceSpan = Math.max(...absValues) - Math.min(...absValues)
  const suspicious = absValues.length >= 2 && varianceSpan < 1
  const denom = absValues.reduce((a, b) => a + b, 0) || 1

  const items: DriverItem[] = top.map(t => ({
    ...t,
    contributionPct: (Math.abs(t.delta ?? 0) / denom) * 100,
    pctDelta: t.pctDelta ?? null,
  }))

  return { items, suspicious }
}

export function getReportData(opts: {
  dataSource: DataSource
  pl: XeroPL | null
  template: DreamTemplate
  scenario: ScenarioInputs
  includeScenario: boolean
  completenessThreshold?: number
  comparisonMode?: ComparisonMode
}): ReportData {
  const { dataSource, pl, template, scenario, includeScenario, completenessThreshold = 0.85, comparisonMode } = opts
  const mapping = calcMappingStats(pl, template)
  const recommendedSource: DataSource = mapping.completeness >= completenessThreshold ? 'dream' : 'legacy'
  const scenarioActive = includeScenario && scenario.enabled
  const mode: ComparisonMode = comparisonMode ? comparisonMode : scenarioActive ? 'scenario_vs_current' : 'last3_vs_prev3'

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
        dataQualityBadgeLabel: 'Data quality: Missing',
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
        comparisonMode: mode,
        comparisonLabel: 'No data',
        movementBadge: 'Movement unavailable',
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

    const scenarioTotals = scenarioActive ? applyBundledScenario(baseTotals, pl, scenario) : null

    const depAmort = computeDepAmort(pl)
    const ebitdaCurrent = baseTotals.net.map((v, i) => v + (depAmort?.[i] ?? 0))
    const ebitdaScenario = scenarioTotals ? scenarioTotals.net.map((v, i) => v + (depAmort?.[i] ?? 0)) : null

    const lastMonthLabel = months[months.length - 1] ?? 'Current period'
    const periodLabel = `Through ${lastMonthLabel}`

    const netDelta = scenarioTotals ? sum(scenarioTotals.net) - sum(baseTotals.net) : null

    const kpis = [
      { label: 'TTM net profit', current: sum(baseTotals.net), scenario: scenarioTotals ? sum(scenarioTotals.net) : null, variance: netDelta, tone: netDelta != null ? (netDelta >= 0 ? 'good' : 'bad') : undefined },
      { label: 'TTM revenue', current: sum(baseTotals.revenue), scenario: scenarioTotals ? sum(scenarioTotals.revenue) : null, variance: scenarioTotals ? sum(scenarioTotals.revenue) - sum(baseTotals.revenue) : null },
      { label: 'Gross margin %', current: ((sum(baseTotals.revenue) - sum(baseTotals.cogs)) / Math.max(1, Math.abs(sum(baseTotals.revenue)))) * 100 },
      { label: 'EBITDA (est.)', current: sum(ebitdaCurrent), scenario: ebitdaScenario ? sum(ebitdaScenario) : null, variance: ebitdaScenario ? sum(ebitdaScenario) - sum(ebitdaCurrent) : null },
    ]

    const netChange = last3vsPrev3(baseTotals.net)
    const revChange = last3vsPrev3(baseTotals.revenue)
    const gmChange = last3vsPrev3(baseTotals.revenue.map((r, i) => r - (baseTotals.cogs[i] ?? 0)))
    const opexChange = last3vsPrev3(baseTotals.opex)

    const whatChanged: string[] = []
    if (netChange) whatChanged.push(`Net profit moved ${money(netChange.currentTotal - netChange.compareTotal)} vs prior 3 months.`)
    if (revChange) whatChanged.push(`Revenue moved ${money(revChange.currentTotal - revChange.compareTotal)} vs prior 3 months.`)
    if (gmChange) whatChanged.push(`Gross profit moved ${money(gmChange.currentTotal - gmChange.compareTotal)} vs prior 3 months.`)
    if (opexChange) whatChanged.push(`Opex moved ${money(opexChange.currentTotal - opexChange.compareTotal)} vs prior 3 months.`)
    if (!whatChanged.length) whatChanged.push('Not enough history (need 6+ months) to explain recent movements.')

    const trendStats: TrendStats = {}
    if (netChange) trendStats.last3vsPrev3 = `Net profit ${money(netChange.currentTotal - netChange.compareTotal)} vs prior 3 months.`

    const trendRows = months.map((m, i) => ({ month: m, current: baseTotals.net[i] ?? 0, scenario: scenarioTotals ? scenarioTotals.net[i] ?? null : null }))

    const driverDisabled = source === 'dream' && mapping.completeness < completenessThreshold
      ? 'Not enough mapped data (need 85% of key accounts).'
      : undefined

    const revenueEntries = source === 'dream'
      ? flattenLinesWithSection(template.root)
          .filter(l => l.section === 'rev')
          .map(l => ({ label: l.line.label, values: computedDream?.byLineId[l.line.id] ?? Array(pl.months.length).fill(0), sectionType: 'income' as const }))
      : pl.accounts.filter(a => a.section === 'trading_income' || a.section === 'other_income').map(a => ({ label: a.name, values: a.values, sectionType: 'income' as const }))

    const costEntries = source === 'dream'
      ? flattenLinesWithSection(template.root)
          .filter(l => l.section === 'cogs' || l.section === 'opex')
          .map(l => ({ label: l.line.label, values: computedDream?.byLineId[l.line.id] ?? Array(pl.months.length).fill(0), sectionType: 'expense' as const }))
      : pl.accounts
          .filter(a => a.section === 'cost_of_sales' || a.section === 'operating_expenses')
          .map(a => ({ label: a.name, values: a.values, sectionType: 'expense' as const }))

    const revenueDrivers = getDrivers({ entries: revenueEntries, mode, scenarioTotals })
    const costDrivers = getDrivers({ entries: costEntries, mode, scenarioTotals })

    const pnlSummary = [
      { label: 'Revenue', current: sum(baseTotals.revenue), scenario: scenarioTotals ? sum(scenarioTotals.revenue) : null, variance: scenarioTotals ? sum(scenarioTotals.revenue) - sum(baseTotals.revenue) : null },
      { label: 'COGS', current: sum(baseTotals.cogs), scenario: scenarioTotals ? sum(scenarioTotals.cogs) : null, variance: scenarioTotals ? sum(scenarioTotals.cogs) - sum(baseTotals.cogs) : null, tone: scenarioTotals ? (sum(scenarioTotals.cogs) - sum(baseTotals.cogs) <= 0 ? 'good' : 'bad') : undefined },
      { label: 'Gross profit', current: sum(baseTotals.revenue) - sum(baseTotals.cogs), scenario: scenarioTotals ? sum(scenarioTotals.revenue) - sum(scenarioTotals.cogs) : null, variance: scenarioTotals ? (sum(scenarioTotals.revenue) - sum(scenarioTotals.cogs)) - (sum(baseTotals.revenue) - sum(baseTotals.cogs)) : null },
      { label: 'Opex', current: sum(baseTotals.opex), scenario: scenarioTotals ? sum(scenarioTotals.opex) : null, variance: scenarioTotals ? sum(scenarioTotals.opex) - sum(baseTotals.opex) : null, tone: scenarioTotals ? (sum(scenarioTotals.opex) - sum(baseTotals.opex) <= 0 ? 'good' : 'bad') : undefined },
      { label: 'EBITDA (est.)', current: sum(ebitdaCurrent), scenario: ebitdaScenario ? sum(ebitdaScenario) : null, variance: ebitdaScenario ? sum(ebitdaScenario) - sum(ebitdaCurrent) : null },
      { label: 'Net profit', current: sum(baseTotals.net), scenario: scenarioTotals ? sum(scenarioTotals.net) : null, variance: netDelta },
    ]

    const executiveSummary: string[] = []
    executiveSummary.push(`Datasource: ${source === 'dream' ? 'Management P&L (mapped model)' : 'Legacy Xero export'}`)
    if (netDelta != null) executiveSummary.push(`Scenario impact: ${money(netDelta)} vs current.`)
    const comparison = computeComparison(mode, baseTotals.net, scenarioTotals ? scenarioTotals.net : baseTotals.net, scenarioTotals)
    executiveSummary.push(`Comparison mode: ${comparison.label}`)
    executiveSummary.push(...whatChanged.slice(0, 2))
    const topMoverSentences = [...revenueDrivers.items, ...costDrivers.items]
      .sort((a, b) => Math.abs((b.delta ?? 0)) - Math.abs((a.delta ?? 0)))
      .slice(0, 2)
      .map(d => `${d.label} Δ ${d.delta != null ? money(d.delta) : '—'} (${pct(d.pctDelta ?? null)})`)
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

    const dataSourceLabel = source === 'dream' ? 'Management P&L (mapped model)' : 'Legacy P&L (Xero export)'
    const dataQualityBadge = makeDataQualityBadge(source, mapping.completeness, mapping.missingKeyAccounts.length)

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
      dataQualityBadge: dataQualityBadge.badge,
      dataQualityBadgeLabel: dataQualityBadge.badge,
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
      comparisonMode: mode,
      comparisonLabel: comparison.label,
      movementBadge: `Movement = ${comparison.label} (${source === 'dream' ? 'Mapped model' : 'Actuals'})`,
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

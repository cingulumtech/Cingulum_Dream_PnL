import { DreamTemplate, GL, ScenarioInputs, XeroPL } from './types'
import { ComparisonMode, DataSource, getReportData, ReportData } from './reportData'
import { ExportSettings } from './defaults'

export type DatasetFingerprint = {
  id: string
  hash: string
  label: string
}

export type SnapshotReportConfig = {
  dataSource: DataSource
  includeScenario: boolean
  comparisonMode: ComparisonMode
}

export type SnapshotSummary = {
  kpis: ReportData['kpis']
  periodLabel: string
  comparisonLabel: string
  movementBadge: string
  dataSourceUsed: DataSource
}

export function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function fingerprintPl(pl: XeroPL | null): DatasetFingerprint | undefined {
  if (!pl) return undefined
  const base = `${pl.months.length}m-${pl.accounts.length}a`
  const hashSource = pl.accounts
    .slice(0, 25)
    .map(a => `${a.name}:${Math.round(a.total ?? 0)}`)
    .join('|')
  const hash = hashString(`${pl.months.join(',')}|${hashSource}`)
  return { id: `pl-${base}`, hash, label: `${base}` }
}

export function fingerprintGl(gl: GL | null): DatasetFingerprint | undefined {
  if (!gl) return undefined
  const base = `${gl.txns.length}txns`
  const sample = gl.txns.slice(0, 25).map(t => `${t.account}-${t.date}-${Math.round(t.amount)}`).join('|')
  const hash = hashString(sample)
  return { id: `gl-${base}`, hash, label: base }
}

export function fingerprintTemplate(template: DreamTemplate): { templateVersion: string; layoutHash: string } {
  const layoutHash = hashString(JSON.stringify(template.root ?? {}))
  return { templateVersion: template.id ?? 'template', layoutHash }
}

export function buildSnapshotSummary(opts: {
  pl: XeroPL | null
  template: DreamTemplate
  scenario: ScenarioInputs
  reportConfig: SnapshotReportConfig
}): SnapshotSummary {
  const report = getReportData({
    dataSource: opts.reportConfig.dataSource,
    pl: opts.pl,
    template: opts.template,
    scenario: opts.scenario,
    includeScenario: opts.reportConfig.includeScenario,
    comparisonMode: opts.reportConfig.comparisonMode,
  })

  return {
    kpis: report.kpis,
    periodLabel: report.periodLabel,
    comparisonLabel: report.comparisonLabel,
    movementBadge: report.movementBadge,
    dataSourceUsed: report.dataSourceUsed,
  }
}

export function ensureReportConfig(config?: Partial<SnapshotReportConfig>): SnapshotReportConfig {
  return {
    dataSource: config?.dataSource ?? 'legacy',
    includeScenario: config?.includeScenario ?? true,
    comparisonMode: config?.comparisonMode ?? 'last3_vs_prev3',
  }
}

export function ensureExportSettings(settings?: Partial<ExportSettings>): ExportSettings {
  return {
    pageSize: settings?.pageSize ?? 'a4',
    marginMm: settings?.marginMm ?? 12,
  }
}

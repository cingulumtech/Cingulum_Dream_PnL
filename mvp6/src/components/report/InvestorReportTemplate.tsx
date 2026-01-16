import React from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { ReportData } from '../../lib/reportData'
import { AppMark } from '../AppMark'
import { Chip } from '../ui'

const MONEY_FORMATTER = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const PCT_FORMATTER = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 })
const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' })

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-'
  return MONEY_FORMATTER.format(n)
}

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-'
  return `${PCT_FORMATTER.format(n)}%`
}

function formatValue(value: number | null | undefined, format?: 'currency' | 'percentage') {
  return format === 'percentage' ? pct(value) : money(value)
}

export function profitImpactClass(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return 'text-slate-500'
  return value > 0 ? 'text-emerald-600' : 'text-rose-600'
}

function Callout({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="font-semibold text-amber-900">{title}</div>
      <div className="text-amber-800">{detail}</div>
    </div>
  )
}

function Section({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        {badge ? (
          <div className="max-w-[320px] min-w-0 sm:max-w-[40%]">
            {badge}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function DriverTable({ title, result, movementBadge }: { title: string; result: DriverResult; movementBadge: string }) {
  if (result.disabledReason) {
    return <Callout title={`${title} unavailable`} detail={result.disabledReason} />
  }
  if (!result.items.length) {
    return <Callout title={`No ${title.toLowerCase()}`} detail="Not enough movement to surface drivers." />
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
        </div>
        <div className="max-w-[320px] min-w-0 sm:max-w-[40%]">
          <Chip tone="neutral" className="max-w-full px-2 py-[2px] text-[10px]">Movement: {movementBadge}</Chip>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full table-fixed text-[11px] text-slate-700">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-slate-100 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Driver</th>
              <th className="text-right px-3 py-2">Actual</th>
              <th className="text-right px-3 py-2">Comparison</th>
              <th className="text-right px-3 py-2">Change / Percent</th>
              <th className="text-right px-3 py-2">Profit impact</th>
              <th className="text-right px-3 py-2">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map(d => {
              const impactTone = d.profitImpact == null ? 'neutral' : d.profitImpact > 0 ? 'good' : 'bad'
              const impactClass = profitImpactClass(d.profitImpact)
              return (
                <tr key={d.label} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-semibold text-slate-900 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="min-w-0 break-words">{d.label}</span>
                      <Chip tone="neutral" className="shrink-0 max-w-full px-2 py-[2px] text-[10px]">
                        {d.sectionType === 'income' ? 'Income' : 'Expense'}
                      </Chip>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{money(d.currentValue)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{money(d.compareValue)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-semibold">{money(d.delta)}</div>
                    <div className="text-[10px] text-slate-500">{pct(d.pctDelta)}</div>
                  </td>
                  <td className="px-3 py-2 text-right min-w-0">
                    <div className="flex justify-end min-w-0">
                      <Chip
                        tone={impactTone === 'good' ? 'good' : impactTone === 'bad' ? 'bad' : 'neutral'}
                        className={`max-w-full justify-end px-2 py-[2px] text-[10px] ${impactClass}`}
                      >
                        {impactTone === 'good' ? 'Increase' : impactTone === 'bad' ? 'Decrease' : 'No change'} {money(d.profitImpact)}
                      </Chip>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{pct(d.contributionPct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-slate-500">Profit impact accounts for income vs expense polarity.</div>
    </div>
  )
}

function FooterBar({ dataSourceLabel, snapshotId, generatedAt }: { dataSourceLabel: string; snapshotId?: string | null; generatedAt: Date }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-slate-900">Generated by Accounting Atlas</div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] min-w-0">
          <Chip tone="neutral" className="max-w-full px-2 py-[2px] text-[10px]">Source: {dataSourceLabel}</Chip>
          <Chip tone="neutral" className="max-w-full px-2 py-[2px] text-[10px]">Snapshot: {snapshotId ?? 'live data'}</Chip>
          <Chip tone="neutral" className="max-w-full px-2 py-[2px] text-[10px]">{DATETIME_FORMATTER.format(generatedAt)}</Chip>
        </div>
      </div>
    </div>
  )
}

export const InvestorReportTemplate = React.forwardRef<HTMLDivElement, { data: ReportData; meta?: { snapshotId?: string | null; generatedAt?: Date } }>(
  function InvestorReportTemplate({ data, meta }, ref) {
  const {
    dataSourceLabel,
    dataQualityBadge,
    periodLabel,
    kpis,
    executiveSummary,
    whatChanged,
    trendRows,
    trendStats,
    varianceAttribution,
    drivers,
    pnlSummary,
    dataQuality,
    scenarioNotes,
    comparisonLabel,
    movementBadge,
    fallbackReason,
  } = data as ReportData & { fallbackReason?: string }

  const showTrend = trendRows.length > 0
  const showScenario = !!varianceAttribution && !dataQuality.disabledSections.includes('waterfall')
  const showDrivers = !(drivers.revenue.disabledReason && drivers.cost.disabledReason)
  const generatedAt = meta?.generatedAt ?? new Date()
  const snapshotId = meta?.snapshotId ?? null

  const missingMapping = dataQuality.missingAccounts.slice(0, 6)
  const warningLines: string[] = []
  if (fallbackReason) warningLines.push(fallbackReason)
  if (dataQuality.disabledSections.length) warningLines.push(`Sections disabled: ${dataQuality.disabledSections.join(', ')}`)
  if (drivers.revenue.disabledReason || drivers.cost.disabledReason) warningLines.push('Drivers incomplete. Go to Mapping to unlock movement insights.')

  return (
    <div ref={ref} className="report-root text-slate-900 font-sans">
      <section className="pdf-page">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <AppMark size="sm" />
              <div className="text-xs uppercase tracking-wide text-indigo-400">Investor report</div>
              <div className="text-sm text-slate-600">Board-grade performance story with mapped, reconciled data.</div>
              <div className="mt-1 text-xs text-slate-600">Datasource: {dataSourceLabel}</div>
              <div className="text-[11px] text-slate-600 break-words">{movementBadge}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                {dataQualityBadge}
              </div>
              <div className="text-xs text-slate-500">{periodLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{k.label}</div>
                <div className={`text-lg font-semibold ${k.tone === 'good' ? 'text-emerald-600' : k.tone === 'bad' ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatValue(k.current, k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency'))}
                </div>
                {k.variance != null && (
                  <div className="text-xs text-slate-500">
                    Scenario: {formatValue(k.scenario ?? null, k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency'))} (
                    {formatValue(
                      k.label.toLowerCase().includes('%') ? (k.scenario ?? 0) - (k.current ?? 0) : k.variance,
                      k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency')
                    )}{' '}
                    vs current)
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-900">Executive summary</div>
              <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                {executiveSummary.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-900">What changed</div>
              <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
                {whatChanged.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          </div>

          {warningLines.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {warningLines.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200 pt-3">
            <div>Accounting Atlas Cover</div>
            <div>Movement: {movementBadge}</div>
          </div>
        </div>
      </section>

      <section className="pdf-page">
        <Section
          title="Net profit trend with comparison overlay"
          subtitle="Shows current trajectory plus scenario where enabled."
          badge={<Chip tone="neutral" className="px-3 py-1 text-xs">{comparisonLabel}</Chip>}
        >
          {showTrend ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows}>
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.4)', color: '#0f172a' }} />
                  <Legend />
                  <Line type="monotone" dataKey="current" name="Current" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  {trendRows.some(r => r.scenario != null) && <Line type="monotone" dataKey="scenario" name="Scenario" stroke="#16a34a" strokeWidth={2} dot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Callout title="Trend unavailable" detail="Upload at least 6 months of data to plot profit trend." />
          )}
          {trendStats.last3vsPrev3 && <div className="text-xs text-slate-600">{trendStats.last3vsPrev3}</div>}
        </Section>
      </section>

      <section className="pdf-page">
        <Section
          title="Drivers tables"
          subtitle="Actual vs comparison with delta, contribution, and profit impact badges."
          badge={showDrivers ? <Chip tone="neutral" className="px-3 py-1 text-xs">{movementBadge}</Chip> : undefined}
        >
          <div className="grid grid-cols-1 gap-4">
            <DriverTable title="Income drivers" result={drivers.revenue} movementBadge={movementBadge} />
            <DriverTable title="Cost drivers" result={drivers.cost} movementBadge={movementBadge} />
          </div>
        </Section>
      </section>

      <section className="pdf-page">
        <Section
          title="Scenario variance attribution"
          subtitle="Explains where the scenario delta comes from."
          badge={<Chip tone="neutral" className="px-3 py-1 text-xs">Scenario toggle</Chip>}
        >
          {showScenario && varianceAttribution ? (
            <div className="grid grid-cols-1 gap-2">
              {varianceAttribution.map((row, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-sm text-slate-700">{row.label}</div>
                  <div className={`text-sm font-semibold ${row.tone === 'good' ? 'text-emerald-600' : row.tone === 'bad' ? 'text-rose-600' : 'text-slate-900'}`}>{money(row.amount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <Callout title="Scenario attribution unavailable" detail="Turn on scenario and map at least 85% of key accounts to see attribution." />
          )}
          <div className="text-xs text-slate-600">Assumptions: {scenarioNotes.join(', ')}</div>
        </Section>
      </section>

      <section className="pdf-page">
        <Section
          title="P&L summary (current vs scenario)"
          subtitle="Summarises income statement movement."
          badge={<Chip tone="neutral" className="px-3 py-1 text-xs">{comparisonLabel}</Chip>}
        >
          {pnlSummary.length ? (
            <table className="w-full text-xs text-slate-700">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left pb-1">Line</th>
                  <th className="text-right pb-1">Current</th>
                  <th className="text-right pb-1">Scenario</th>
                  <th className="text-right pb-1">Variance</th>
                </tr>
              </thead>
              <tbody>
                {pnlSummary.map(row => (
                  <tr key={row.label} className="border-t border-slate-200">
                    <td className="py-1">{row.label}</td>
                    <td className="py-1 text-right">{formatValue(row.current, row.format)}</td>
                    <td className="py-1 text-right">{row.scenario != null ? formatValue(row.scenario, row.format) : '-'}</td>
                    <td className={`py-1 text-right ${((row.variance ?? 0) >= 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {row.variance != null ? formatValue(row.variance, row.format) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Callout title="P&L summary unavailable" detail="Upload a P&L to see investor summary lines." />
          )}
        </Section>
      </section>

      <section className="pdf-page">
        <div className="space-y-4">
          <Section
            title="Appendix"
            subtitle="Assumptions, methodology, and data quality."
            badge={<Chip tone="neutral" className="px-3 py-1 text-xs">Accounting Atlas</Chip>}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-semibold text-slate-900">Assumptions & methodology</div>
                <ul className="text-xs text-slate-700 list-disc pl-4 space-y-1">
                  {scenarioNotes.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                  <li>Datasource used: {dataSourceLabel}. Report never mixes sources silently.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-semibold text-slate-900">Data quality</div>
                <ul className="text-xs text-slate-700 list-disc pl-4 space-y-1">
                  <li>Mapping completeness: {(dataQuality.mappingCompleteness * 100).toFixed(0)}%</li>
                  <li>Missing key accounts: {dataQuality.missingKeyAccounts.length}</li>
                  {missingMapping.length > 0 && <li>Examples to map: {missingMapping.join(', ')}</li>}
                  {dataQuality.disabledSections.length > 0 && <li>Sections disabled: {dataQuality.disabledSections.join(', ')}</li>}
                  <li>How to fix: Map the missing accounts in the Mapping page to unlock drivers and attribution.</li>
                </ul>
              </div>
            </div>
          </Section>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <AppMark size="sm" />
            <div className="text-right leading-tight">
              <div>Accounting Atlas - Cingulum Health</div>
              <div>{periodLabel}</div>
            </div>
          </div>

          <FooterBar dataSourceLabel={dataSourceLabel} snapshotId={snapshotId} generatedAt={generatedAt} />
        </div>
      </section>
    </div>
  )
})

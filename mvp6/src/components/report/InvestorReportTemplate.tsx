import React from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { ReportData } from '../../lib/reportData'

const MONEY_FORMATTER = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
const PCT_FORMATTER = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 })

function money(n: number | null | undefined) {
  if (n == null) return '—'
  return MONEY_FORMATTER.format(n)
}

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${PCT_FORMATTER.format(n)}%`
}

function formatValue(value: number | null | undefined, format?: 'currency' | 'percentage') {
  return format === 'percentage' ? pct(value) : money(value)
}

function Callout({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
      <div className="font-semibold text-amber-50">{title}</div>
      <div>{detail}</div>
    </div>
  )
}

export function InvestorReportTemplate({ data }: { data: ReportData }) {
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

  const missingMapping = dataQuality.missingAccounts.slice(0, 6)
  const mappingHint = missingMapping.length ? ` Map these next: ${missingMapping.join(', ')}.` : ' Map missing accounts to unlock drivers.'
  const warningLines: string[] = []
  if (fallbackReason) warningLines.push(fallbackReason)
  if (dataQuality.disabledSections.length) warningLines.push(`Sections disabled: ${dataQuality.disabledSections.join(', ')}`)
  if (drivers.revenue.disabledReason || drivers.cost.disabledReason) warningLines.push('Drivers incomplete. Go to Mapping to unlock movement insights.')

  return (
    <div className="bg-slate-950 text-slate-100 font-sans w-full max-w-none mx-auto p-8 space-y-8">
      {/* Page 1 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-indigo-300">Investor Report</div>
          <div className="text-2xl font-semibold">Cingulum Dream P&L</div>
          <div className="text-sm text-slate-400">{periodLabel}</div>
          <div className="mt-2 text-xs text-slate-300">Datasource: {dataSourceLabel}</div>
          <div className="mt-1 text-[11px] text-slate-300">{movementBadge}</div>
        </div>
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          {dataQualityBadge}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className={`text-lg font-semibold ${k.tone === 'good' ? 'text-emerald-300' : k.tone === 'bad' ? 'text-rose-300' : 'text-slate-100'}`}>
              {formatValue(k.current, k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency'))}
            </div>
            {k.variance != null && (
              <div className="text-xs text-slate-400">
                Scenario: {formatValue(k.scenario ?? null, k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency'))} (
                {formatValue(k.label.toLowerCase().includes('%') ? (k.scenario ?? 0) - (k.current ?? 0) : k.variance, k.format ?? (k.label.toLowerCase().includes('%') ? 'percentage' : 'currency'))} vs current)
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Executive summary</div>
          <ul className="text-sm text-slate-200 list-disc pl-5 space-y-1">
            {executiveSummary.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">What changed (last 3 vs prior 3)</div>
          <ul className="text-sm text-slate-200 list-disc pl-5 space-y-1">
            {whatChanged.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      {warningLines.length > 0 && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          {warningLines.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Page 2 */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Net profit trend with scenario overlay</div>
          <div className="text-xs text-slate-400">{comparisonLabel}</div>
        </div>
        {showTrend ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows}>
                <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="current" name="Current" stroke="#38bdf8" strokeWidth={2} dot={false} />
                {trendRows.some(r => r.scenario != null) && <Line type="monotone" dataKey="scenario" name="Scenario" stroke="#22c55e" strokeWidth={2} dot={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Callout title="Trend unavailable" detail="Upload at least 6 months of data to plot profit trend." />
        )}
      </div>

      {/* Page 3: Drivers */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Income drivers (Actual + Movement)</div>
          <div className="text-xs text-slate-400">{movementBadge}</div>
        </div>
        {drivers.revenue.disabledReason ? (
          <Callout
            title="Drivers unavailable"
            detail={`${drivers.revenue.disabledReason}${drivers.revenue.disabledReason.toLowerCase().includes('mapped') ? mappingHint : ''}`}
          />
        ) : drivers.revenue.items.length ? (
          <div className="text-[11px] text-slate-200">
            <div className="flex text-xs text-slate-400 font-semibold border-b border-white/10 pb-1">
              <div className="w-1/4">Driver</div>
              <div className="w-1/5 text-right">Actual</div>
              <div className="w-1/5 text-right">Comparison</div>
              <div className="w-1/5 text-right">Δ (profit impact)</div>
              <div className="w-1/5 text-right">Contribution</div>
            </div>
            {drivers.revenue.items.map(d => {
              const impactTone = d.profitImpact == null ? 'text-slate-200' : d.profitImpact > 0 ? 'text-emerald-300' : d.profitImpact < 0 ? 'text-rose-300' : 'text-slate-200'
              return (
                <div key={d.label} className="flex items-center border-b border-white/5 py-1">
                  <div className="w-1/4 font-semibold text-slate-100">{d.label}</div>
                  <div className="w-1/5 text-right">{money(d.currentValue)}</div>
                  <div className="w-1/5 text-right">{money(d.compareValue)}</div>
                  <div className={`w-1/5 text-right font-semibold ${impactTone}`}>
                    {money(d.delta)} ({pct(d.pctDelta)})
                  </div>
                  <div className="w-1/5 text-right">{pct(d.contributionPct)}</div>
                </div>
              )
            })}
            <div className="text-[11px] text-slate-400 pt-1">▲ improves profit / ▼ reduces profit (income up is good, down is bad).</div>
          </div>
        ) : (
          <Callout title="No revenue drivers" detail="Not enough movement to surface revenue drivers." />
        )}
      </div>

      {/* Page 4: Cost drivers */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Cost drivers (Actual + Movement)</div>
          <div className="text-xs text-slate-400">{movementBadge}</div>
        </div>
        {drivers.cost.disabledReason ? (
          <Callout
            title="Drivers unavailable"
            detail={`${drivers.cost.disabledReason}${drivers.cost.disabledReason.toLowerCase().includes('mapped') ? mappingHint : ''}`}
          />
        ) : drivers.cost.items.length ? (
          <div className="text-[11px] text-slate-200">
            <div className="flex text-xs text-slate-400 font-semibold border-b border-white/10 pb-1">
              <div className="w-1/4">Driver</div>
              <div className="w-1/5 text-right">Actual</div>
              <div className="w-1/5 text-right">Comparison</div>
              <div className="w-1/5 text-right">Δ (profit impact)</div>
              <div className="w-1/5 text-right">Contribution</div>
            </div>
            {drivers.cost.items.map(d => {
              const impactTone = d.profitImpact == null ? 'text-slate-200' : d.profitImpact > 0 ? 'text-emerald-300' : d.profitImpact < 0 ? 'text-rose-300' : 'text-slate-200'
              return (
                <div key={d.label} className="flex items-center border-b border-white/5 py-1">
                  <div className="w-1/4 font-semibold text-slate-100">{d.label}</div>
                  <div className="w-1/5 text-right">{money(d.currentValue)}</div>
                  <div className="w-1/5 text-right">{money(d.compareValue)}</div>
                  <div className={`w-1/5 text-right font-semibold ${impactTone}`}>
                    {money(d.delta)} ({pct(d.pctDelta)})
                  </div>
                  <div className="w-1/5 text-right">{pct(d.contributionPct)}</div>
                </div>
              )
            })}
            <div className="text-[11px] text-slate-400 pt-1">▲ improves profit / ▼ reduces profit (cost down is good, up is bad).</div>
          </div>
        ) : (
          <Callout title="No cost drivers" detail="Not enough movement to surface cost drivers." />
        )}
      </div>

      {/* Page 5 */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="text-sm font-semibold">P&L summary (current vs scenario)</div>
        {pnlSummary.length ? (
          <table className="w-full text-xs text-slate-200">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left pb-1">Line</th>
                <th className="text-right pb-1">Current</th>
                <th className="text-right pb-1">Scenario</th>
                <th className="text-right pb-1">Variance</th>
              </tr>
            </thead>
            <tbody>
              {pnlSummary.map(row => (
                <tr key={row.label} className="border-t border-white/5">
                  <td className="py-1">{row.label}</td>
                  <td className="py-1 text-right">{formatValue(row.current, row.format)}</td>
                  <td className="py-1 text-right">{row.scenario != null ? formatValue(row.scenario, row.format) : '—'}</td>
                  <td className={`py-1 text-right ${((row.variance ?? 0) >= 0) ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {row.variance != null ? formatValue(row.variance, row.format) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Callout title="P&L summary unavailable" detail="Upload a P&L to see investor summary lines." />
        )}
      </div>

      {/* Page 6: Scenario attribution */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Scenario variance attribution</div>
          <div className="text-xs text-slate-400">Explains where the scenario delta comes from.</div>
        </div>
        {showScenario && varianceAttribution ? (
          <div className="grid grid-cols-1 gap-2">
            {varianceAttribution.map((row, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-sm text-slate-200">{row.label}</div>
                <div className={`text-sm font-semibold ${row.tone === 'good' ? 'text-emerald-300' : row.tone === 'bad' ? 'text-rose-300' : 'text-slate-100'}`}>{money(row.amount)}</div>
              </div>
            ))}
          </div>
        ) : (
          <Callout title="Scenario attribution unavailable" detail="Turn on scenario and map at least 85% of key accounts to see attribution." />
        )}
        <div className="text-xs text-slate-300">Assumptions: {scenarioNotes.join(' • ')}</div>
      </div>

      {/* Appendix */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="text-sm font-semibold">Assumptions & methodology</div>
        <ul className="text-xs text-slate-200 list-disc pl-4 space-y-1">
          {scenarioNotes.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
          <li>Datasource used: {dataSourceLabel}. Report never mixes sources silently.</li>
        </ul>
        <div className="text-sm font-semibold pt-3">Data quality</div>
        <ul className="text-xs text-slate-200 list-disc pl-4 space-y-1">
          <li>Mapping completeness: {(dataQuality.mappingCompleteness * 100).toFixed(0)}%</li>
          <li>Missing key accounts: {dataQuality.missingKeyAccounts.length}</li>
          {missingMapping.length > 0 && <li>Examples to map: {missingMapping.join(', ')}</li>}
          {dataQuality.disabledSections.length > 0 && <li>Sections disabled: {dataQuality.disabledSections.join(', ')}</li>}
          <li>How to fix: Map the missing accounts in the Mapping page to unlock drivers and attribution.</li>
        </ul>
      </div>
    </div>
  )
}

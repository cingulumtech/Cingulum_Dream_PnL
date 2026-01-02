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
  if (n == null) return '—'
  return `${PCT_FORMATTER.format(n)}%`
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
  } = data

  const showTrend = trendRows.length > 0
  const showScenario = !!varianceAttribution && !dataQuality.disabledSections.includes('waterfall')
  const showDrivers = !(drivers.revenue.disabledReason && drivers.cost.disabledReason)

  const missingMapping = dataQuality.missingAccounts.slice(0, 6)
  const mappingHint = missingMapping.length ? ` Map these next: ${missingMapping.join(', ')}.` : ' Map missing accounts to unlock drivers.'
  const disabledList = dataQuality.disabledSections.length ? dataQuality.disabledSections.join(', ') : 'None'

  return (
    <div className="bg-slate-950 text-slate-100 font-sans w-[900px] mx-auto p-8 space-y-8">
      {/* Page 1 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-indigo-300">Investor Report</div>
          <div className="text-2xl font-semibold">Cingulum Dream P&L</div>
          <div className="text-sm text-slate-400">{periodLabel}</div>
          <div className="mt-2 text-xs text-slate-300">Datasource: {dataSourceLabel}</div>
        </div>
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          Data quality: {dataQualityBadge}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className={`text-lg font-semibold ${k.tone === 'good' ? 'text-emerald-300' : k.tone === 'bad' ? 'text-rose-300' : 'text-slate-100'}`}>{money(k.current)}</div>
            {k.variance != null && (
              <div className="text-xs text-slate-400">Scenario: {money(k.scenario ?? null)} ({money(k.variance)} vs current)</div>
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

      {/* Page 2 */}
      <div className="page-break rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Net profit trend with scenario overlay</div>
          <div className="text-xs text-slate-400">{trendStats.last3vsPrev3 ?? 'Need 6+ months for movement stats.'}</div>
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
        <div className="grid grid-cols-3 gap-3 text-xs text-slate-200">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">Volatility: <span className="font-semibold text-slate-100">{trendStats.volatility ?? 'n/a'}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">Mapping gaps: <span className="font-semibold text-slate-100">{dataQuality.missingAccounts.length}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">Sections disabled: <span className="font-semibold text-slate-100">{disabledList}</span></div>
        </div>
      </div>

      {/* Page 3 */}
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
          <Callout title="Scenario waterfall disabled" detail="Turn on scenario and map at least 85% of key accounts to see attribution." />
        )}
        <div className="text-xs text-slate-300">Assumptions: {scenarioNotes.join(' • ')}</div>
      </div>

      {/* Page 4 */}
      <div className="page-break grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Revenue drivers (movement)</div>
          {drivers.revenue.disabledReason ? (
            <Callout
              title="Drivers unavailable"
              detail={`${drivers.revenue.disabledReason}${drivers.revenue.disabledReason.toLowerCase().includes('mapped') ? mappingHint : ''}`}
            />
          ) : drivers.revenue.items.length ? (
            <div className="space-y-2">
              {drivers.revenue.items.map(d => (
                <div key={d.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-100">{d.label}</div>
                    <div className="text-slate-400">Contribution {pct(d.contributionPct)}</div>
                  </div>
                  <div className={`font-semibold ${d.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(d.delta)}</div>
                </div>
              ))}
            </div>
          ) : (
            <Callout title="No revenue drivers" detail="Not enough movement to surface revenue drivers." />
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="text-sm font-semibold">Cost drivers (movement)</div>
          {drivers.cost.disabledReason ? (
            <Callout
              title="Drivers unavailable"
              detail={`${drivers.cost.disabledReason}${drivers.cost.disabledReason.toLowerCase().includes('mapped') ? mappingHint : ''}`}
            />
          ) : drivers.cost.items.length ? (
            <div className="space-y-2">
              {drivers.cost.items.map(d => (
                <div key={d.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-100">{d.label}</div>
                    <div className="text-slate-400">Contribution {pct(d.contributionPct)}</div>
                  </div>
                  <div className={`font-semibold ${d.delta <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(d.delta)}</div>
                </div>
              ))}
            </div>
          ) : (
            <Callout title="No cost drivers" detail="Not enough movement to surface cost drivers." />
          )}
        </div>
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
                  <td className="py-1 text-right">{money(row.current)}</td>
                  <td className="py-1 text-right">{row.scenario != null ? money(row.scenario) : '—'}</td>
                  <td className={`py-1 text-right ${((row.variance ?? 0) >= 0) ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {row.variance != null ? money(row.variance) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Callout title="P&L summary unavailable" detail="Upload a P&L to see investor summary lines." />
        )}
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

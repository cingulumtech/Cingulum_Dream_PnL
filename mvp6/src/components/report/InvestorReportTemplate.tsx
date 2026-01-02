import React from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Insight } from '../../lib/insightEngine'

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

type Props = {
  company?: string
  periodLabel: string
  kpis: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }[]
  insights: Insight[]
  trendRows: { month: string; current: number; scenario?: number | null }[]
  trendStats: { cagr: string; volatility: string; last3vsPrev3: string }
  dataQuality: string[]
  waterfall?: { label: string; value: number }[]
  drivers?: { label: string; delta: number; pct: string }[]
  pnlSummary?: { label: string; current: number; scenario?: number | null; variance?: number | null }[]
  assumptions: string[]
}

export const InvestorReportTemplate = React.forwardRef<HTMLDivElement, Props>(function Template(props, ref) {
  const { company, periodLabel, kpis, insights, trendRows, trendStats, dataQuality, drivers = [], pnlSummary = [], assumptions, waterfall = [] } = props
  const trendData = trendRows.map(r => ({ month: r.month, current: r.current, scenario: r.scenario ?? null }))

  return (
    <div ref={ref} className="bg-slate-950 text-slate-100 font-sans w-[900px] mx-auto p-8 space-y-8">
      {/* Cover + Executive summary */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-indigo-300">Investor Report</div>
        <div className="text-2xl font-semibold">{company || 'Cingulum Dream P&L'}</div>
        <div className="text-sm text-slate-400">{periodLabel}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className={`text-lg font-semibold ${k.tone === 'good' ? 'text-emerald-300' : k.tone === 'bad' ? 'text-rose-300' : 'text-slate-100'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="text-sm font-semibold">Executive summary</div>
        <ul className="text-sm text-slate-200 list-disc pl-5 space-y-1">
          {insights.map((i, idx) => (
            <li key={idx}><span className="font-semibold text-slate-100">{i.title}:</span> {i.detail}</li>
          ))}
        </ul>
      </div>

      {/* Trend & stats */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 page-break-avoid">
        <div className="text-sm font-semibold">Net profit trend (current vs scenario)</div>
        {trendData.length === 0 ? (
          <div className="text-xs text-amber-200">Not enough mapped data to show trend. Upload P&L and map key accounts.</div>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="month" tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="current" name="Current" stroke="#38bdf8" strokeWidth={2} dot={false} />
                {trendData.some(d => d.scenario != null) ? (
                  <Line type="monotone" dataKey="scenario" name="Scenario" stroke="#22c55e" strokeWidth={2} dot={false} />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-xs text-slate-200">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">CAGR-ish: <span className="font-semibold text-slate-100">{trendStats.cagr}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">Volatility: <span className="font-semibold text-slate-100">{trendStats.volatility}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">Last 3 vs prior 3: <span className="font-semibold text-slate-100">{trendStats.last3vsPrev3}</span></div>
        </div>
      </div>

      {/* Waterfall placeholder */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 page-break">
        <div className="text-sm font-semibold">Scenario variance (waterfall)</div>
        {waterfall.length === 0 ? (
          <div className="text-xs text-amber-200">Not enough mapped data to generate variance waterfall. Complete mapping and enable scenario.</div>
        ) : (
          <div className="text-xs text-slate-200">Waterfall chart placeholder (implement with Recharts BarChart if data available).</div>
        )}
      </div>

      {/* Drivers */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 page-break-avoid">
        <div className="text-sm font-semibold">Top drivers</div>
        {drivers.length === 0 ? (
          <div className="text-xs text-amber-200">Not enough mapped data to surface drivers.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 text-xs text-slate-200">
            {drivers.map(d => (
              <div key={d.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <div className="font-semibold text-slate-100">{d.label}</div>
                  <div className="text-slate-400">Contribution {d.pct}</div>
                </div>
                <div className={`font-semibold ${d.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(d.delta)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* P&L summary */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 page-break">
        <div className="text-sm font-semibold">P&L summary</div>
        {pnlSummary.length === 0 ? (
          <div className="text-xs text-amber-200">Not enough mapped data to summarize P&L.</div>
        ) : (
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
        )}
      </div>

      {/* Appendix */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 page-break">
        <div className="text-sm font-semibold">Assumptions & methodology</div>
        <ul className="text-xs text-slate-200 list-disc pl-4 space-y-1">
          {assumptions.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
        <div className="text-sm font-semibold pt-3">Data quality</div>
        <ul className="text-xs text-slate-200 list-disc pl-4 space-y-1">
          {dataQuality.map((d, idx) => (
            <li key={idx}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  )
})

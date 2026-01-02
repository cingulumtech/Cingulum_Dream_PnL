import React from 'react'
import { Card, Input, Label } from '../ui'

export type BuilderState = {
  reportType: 'investor' | 'board' | 'ops'
  period: 'ttm' | 'fytd' | 'custom'
  projectionMonths: number
  growthPct: number
  includeScenario: boolean
  confidence: number
  sections: Record<string, boolean>
  preset: 'investor' | 'scenario' | 'lean'
  onChange: (s: Partial<BuilderState>) => void
}

const sectionList = [
  { id: 'executive', label: 'Executive summary' },
  { id: 'kpi', label: 'KPI dashboard' },
  { id: 'trend', label: 'Trend & seasonality' },
  { id: 'waterfall', label: 'Scenario variance (waterfall)' },
  { id: 'drivers', label: 'Drivers (top movers)' },
  { id: 'pnl', label: 'P&L summary' },
  { id: 'cost', label: 'Cost structure & margin' },
  { id: 'appendix', label: 'Assumptions & methodology' },
]

export function ReportBuilderPanel(props: BuilderState) {
  const { reportType, period, projectionMonths, growthPct, includeScenario, confidence, sections, preset, onChange } = props

  return (
    <Card className="p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-100">Report Builder</div>
        <div className="text-xs text-slate-400">Choose presets, scope, and projections.</div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label>Report type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['investor', 'board', 'ops'] as const).map(t => (
              <button
                key={t}
                onClick={() => onChange({ reportType: t })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                  reportType === t ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {t === 'investor' ? 'Investor' : t === 'board' ? 'Board' : 'Ops'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Period</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['ttm', 'fytd', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => onChange({ period: p })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                  period === p ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {p === 'ttm' ? 'Last 12 months' : p === 'fytd' ? 'FYTD' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Projection months</Label>
            <Input className="mt-1" type="number" value={projectionMonths} onChange={(e) => onChange({ projectionMonths: Math.max(1, Math.min(60, Number(e.target.value))) })} />
          </div>
          <div>
            <Label>Monthly growth (%)</Label>
            <Input className="mt-1" type="number" value={growthPct} onChange={(e) => onChange({ growthPct: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Confidence</Label>
            <Input className="mt-1" type="range" min={0} max={100} value={confidence} onChange={(e) => onChange({ confidence: Number(e.target.value) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={includeScenario}
            onChange={(e) => onChange({ includeScenario: e.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-transparent"
          />
          Include scenario overlay
        </label>

        <div>
          <Label>Sections</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sectionList.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={sections[s.id]}
                  onChange={(e) => onChange({ sections: { ...sections, [s.id]: e.target.checked } })}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Preset</Label>
          <select
            value={preset}
            onChange={(e) => onChange({ preset: e.target.value as any })}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-100 outline-none"
          >
            <option value="investor">Default investor pack</option>
            <option value="scenario">Scenario pitch pack</option>
            <option value="lean">Lean one-pager</option>
          </select>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
          <div className="font-semibold text-slate-100">Data quality</div>
          <div>Mapping completeness: heuristic only.</div>
          <div>Missing accounts: surfaced in report if gaps exist.</div>
        </div>
      </div>
    </Card>
  )
}

import React from 'react'
import { Card, Label } from '../ui'
import { ComparisonMode, DataSource } from '../../lib/reportData'

export type BuilderState = {
  dataSource: DataSource
  includeScenario: boolean
  recommendedSource: DataSource
  mappingCompleteness: number
  mappingWarnings: string[]
  comparisonMode: ComparisonMode
  onChange: (s: Partial<BuilderState>) => void
}

export function ReportBuilderPanel(props: BuilderState) {
  const { dataSource, includeScenario, recommendedSource, mappingCompleteness, mappingWarnings, comparisonMode, onChange } = props

  return (
    <Card className="p-4 space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-100">Report Builder</div>
        <div className="text-xs text-slate-400">Choose data source and scenario overlay. No filler controls.</div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label>Data source (required)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['legacy', 'dream'] as const).map(src => (
              <button
                key={src}
                onClick={() => onChange({ dataSource: src })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                  dataSource === src ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {src === 'legacy' ? 'P&L (Legacy)' : 'P&L (Management)'}
                {recommendedSource === src ? ' • default' : ''}
              </button>
            ))}
          </div>
          {recommendedSource === 'legacy' && (
            <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Dream mapping below threshold. Defaulting to Legacy until at least 85% of key accounts are mapped.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200 space-y-1">
          <div className="font-semibold text-slate-100">Mapping quality</div>
          <div>Mapped coverage: {(mappingCompleteness * 100).toFixed(0)}%</div>
          {mappingWarnings.map((w, idx) => (
            <div key={idx} className="text-amber-100">{w}</div>
          ))}
        </div>

        <div>
          <Label>Scenario overlay</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => onChange({ includeScenario: true })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                includeScenario ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
              }`}
            >
              Scenario ON
            </button>
            <button
              onClick={() => onChange({ includeScenario: false })}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                !includeScenario ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
              }`}
            >
              Scenario OFF
            </button>
          </div>
        </div>

        <div>
          <Label>Comparison mode (controls movement math)</Label>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {([
              { id: 'last3_vs_prev3', label: 'Last 3 months vs prior 3 months' },
              { id: 'scenario_vs_current', label: 'Scenario vs Current (TTM)' },
              { id: 'month_vs_prior', label: 'Last month vs prior month' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => onChange({ comparisonMode: opt.id })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold text-left ${
                  comparisonMode === opt.id ? 'border-indigo-400/40 bg-indigo-400/15 text-white' : 'border-white/10 bg-white/5 text-slate-200'
                }`}
              >
                {opt.label}
                {opt.id === 'scenario_vs_current' && includeScenario && <span className="ml-2 text-emerald-200">(recommended for scenario)</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

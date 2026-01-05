import React, { useMemo } from 'react'
import { XeroPL } from '../lib/types'
import { analyzeDataHealth } from '../lib/dataHealth'
import { Chip, Label } from './ui'

export function DataHealthSummary({ pl, className }: { pl: XeroPL; className?: string }) {
  const summary = useMemo(() => analyzeDataHealth(pl), [pl])

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">Data health</div>
          <div className="text-xs text-slate-400">Detected months, gaps, and any anomalies we padded for you.</div>
        </div>
        <Chip tone={summary.gaps.length === 0 && summary.anomalies.length === 0 ? 'good' : 'neutral'}>
          {summary.monthsDetected} months
        </Chip>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <Label>Range detected</Label>
          <div className="mt-1 text-sm font-semibold text-slate-100">{summary.rangeLabel}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <Label>Gaps</Label>
          {summary.gaps.length === 0 ? (
            <div className="mt-1 text-sm text-emerald-200">No gaps</div>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-amber-100">
              {summary.gaps.map((g, i) => (
                <li key={i}>• {g}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
          <Label>Anomalies</Label>
          {summary.anomalies.length === 0 ? (
            <div className="mt-1 text-sm text-emerald-200">Clean</div>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-rose-100">
              {summary.anomalies.map((g, i) => (
                <li key={i}>• {g}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

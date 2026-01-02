import React, { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Chip, Input, Label, Button } from './ui'

export function SavedExports() {
  const snapshots = useAppStore(s => s.snapshots)
  const addSnapshot = useAppStore(s => s.addSnapshot)
  const loadSnapshot = useAppStore(s => s.loadSnapshot)
  const deleteSnapshot = useAppStore(s => s.deleteSnapshot)
  const renameSnapshot = useAppStore(s => s.renameSnapshot)
  const duplicateSnapshot = useAppStore(s => s.duplicateSnapshot)
  const setView = useAppStore(s => s.setView)
  const [name, setName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [compareBase, setCompareBase] = useState<string | null>(null)
  const [compareTarget, setCompareTarget] = useState<string | null>(null)

  const compareRows = useMemo(() => {
    const base = snapshots.find(s => s.id === compareBase)
    const target = snapshots.find(s => s.id === compareTarget)
    if (!base || !target) return []
    return base.summary.kpis.map(kpi => {
      const other = target.summary.kpis.find(k => k.label === kpi.label)
      const delta = other && kpi.current != null && other.current != null ? other.current - kpi.current : null
      return {
        label: kpi.label,
        base: kpi.current,
        target: other?.current ?? null,
        delta,
      }
    })
  }, [compareBase, compareTarget, snapshots])

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Saved Exports</div>
            <div className="text-xs text-slate-400">Capture the current scenario + uploads as a snapshot.</div>
          </div>
          <div className="flex gap-2">
            <Input
              className="w-56"
              placeholder="Name this snapshot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (!name.trim()) return
                addSnapshot(name.trim())
                setName('')
              }}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
            >
              Save snapshot
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-xs text-slate-300">No snapshots saved yet.</div>
          ) : (
            snapshots.map(snap => (
              <div key={snap.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    {renameId === snap.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-56"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder="Snapshot name"
                        />
                        <Button
                          onClick={() => {
                            if (!renameValue.trim()) return
                            renameSnapshot(snap.id, renameValue.trim())
                            setRenameId(null)
                            setRenameValue('')
                          }}
                        >
                          Save
                        </Button>
                        <Button variant="ghost" onClick={() => setRenameId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-100">{snap.name}</div>
                    )}
                    <div className="text-xs text-slate-400">{new Date(snap.createdAt).toLocaleString()}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      {snap.fingerprints.pl ? <Chip className="px-2 py-1">P&L {snap.fingerprints.pl.label} · {snap.fingerprints.pl.hash}</Chip> : <Chip className="px-2 py-1">P&L missing</Chip>}
                      {snap.fingerprints.gl ? <Chip className="px-2 py-1">GL {snap.fingerprints.gl.label}</Chip> : <Chip className="px-2 py-1">GL missing</Chip>}
                      <Chip className="px-2 py-1">Template v{snap.fingerprints.templateVersion}</Chip>
                      <Chip className="px-2 py-1">Layout {snap.fingerprints.layoutHash}</Chip>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        loadSnapshot(snap.id)
                        setView('reports')
                      }}
                    >
                      Generate report
                    </Button>
                    <Button
                      onClick={() => loadSnapshot(snap.id)}
                      variant="primary"
                      className="bg-emerald-500/20 border-emerald-400/30 text-emerald-100"
                    >
                      Load
                    </Button>
                    <Button variant="ghost" onClick={() => duplicateSnapshot(snap.id)}>
                      Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setRenameId(snap.id)
                        setRenameValue(snap.name)
                      }}
                    >
                      Rename
                    </Button>
                    <Button variant="danger" onClick={() => deleteSnapshot(snap.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                    <div className="font-semibold text-slate-100 mb-1">Scenario config</div>
                    <div>State: {snap.scenario.state}</div>
                    <div>Pricing: ${snap.scenario.cbaPrice} / ${snap.scenario.programPrice}</div>
                    <div>Volume: {snap.scenario.cbaMonthlyCount} CBA / {snap.scenario.programMonthlyCount} cgTMS</div>
                    <div>Costs applied: {snap.scenario.addBundleCostsToScenario ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                    <div className="font-semibold text-slate-100 mb-1">Report config</div>
                    <div>Source: {snap.reportConfig.dataSource}</div>
                    <div>Scenario overlay: {snap.reportConfig.includeScenario ? 'On' : 'Off'}</div>
                    <div>Comparison: {snap.reportConfig.comparisonMode}</div>
                    <div>Export: {snap.exportSettings.pageSize.toUpperCase()} · {snap.exportSettings.marginMm}mm</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                    <div className="font-semibold text-slate-100 mb-1">Key KPIs</div>
                    <div className="space-y-1">
                      {snap.summary.kpis.slice(0, 3).map(kpi => (
                        <div key={kpi.label} className="flex justify-between">
                          <span>{kpi.label}</span>
                          <span className="text-slate-100">{Math.round(kpi.current ?? 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {snapshots.length >= 2 ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Compare snapshots</div>
              <div className="text-xs text-slate-400">Quick KPI deltas between any two saved exports.</div>
            </div>
            <Chip className="px-2 py-1 h-7">Δ KPI</Chip>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <Label>Base</Label>
              <select
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none"
                value={compareBase ?? ''}
                onChange={(e) => setCompareBase(e.target.value || null)}
              >
                <option value="">Select snapshot</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Target</Label>
              <select
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none"
                value={compareTarget ?? ''}
                onChange={(e) => setCompareTarget(e.target.value || null)}
              >
                <option value="">Select snapshot</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {compareRows.length > 0 ? (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {compareRows.map(row => (
                <div key={row.label} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                  <div className="font-semibold text-slate-100">{row.label}</div>
                  <div className="flex justify-between text-slate-300">
                    <span>Base</span>
                    <span>{row.base != null ? Math.round(row.base).toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Target</span>
                    <span>{row.target != null ? Math.round(row.target).toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-100">
                    <span>Δ</span>
                    <span className={row.delta != null && row.delta >= 0 ? 'text-emerald-200' : 'text-rose-200'}>
                      {row.delta != null ? Math.round(row.delta).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-300">Select two snapshots to see KPI movement.</div>
          )}
        </Card>
      ) : null}
    </div>
  )
}

import React, { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label, Button } from './ui'

export function SavedExports() {
  const snapshots = useAppStore(s => s.snapshots)
  const addSnapshot = useAppStore(s => s.addSnapshot)
  const loadSnapshot = useAppStore(s => s.loadSnapshot)
  const deleteSnapshot = useAppStore(s => s.deleteSnapshot)
  const activeSnapshotId = useAppStore(s => s.activeSnapshotId)
  const clearActiveSnapshot = useAppStore(s => s.clearActiveSnapshot)
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
            <div className="text-sm font-semibold text-slate-100">Snapshots</div>
            <div className="text-xs text-slate-400">Capture the current scenario + uploads as a reusable snapshot.</div>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              onClick={() => clearActiveSnapshot()}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"
              disabled={!activeSnapshotId}
            >
              Clear active
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {snapshots.length === 0 ? (
            <Card className="p-3 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">No snapshots yet</div>
                  <div className="text-xs text-slate-200">Save your current mapping + uploads to reuse later.</div>
                </div>
                <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Load P&amp;L</Button>
              </div>
            </Card>
          ) : (
            snapshots.map(snap => {
              const isActive = activeSnapshotId === snap.id
              return (
                <div
                  key={snap.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 ${isActive ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-100">{snap.name}</div>
                      {isActive ? <Chip tone="good" className="px-2 py-[2px] text-[10px]">Active</Chip> : null}
                    </div>
                    <div className="text-xs text-slate-400">{new Date(snap.createdAt).toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500">ID: {snap.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadSnapshot(snap.id)}
                      className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSnapshot(snap.id)}
                      className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
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

import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label, Button } from './ui'

export function SavedExports() {
  const snapshots = useAppStore(s => s.snapshots)
  const addSnapshot = useAppStore(s => s.addSnapshot)
  const loadSnapshot = useAppStore(s => s.loadSnapshot)
  const deleteSnapshot = useAppStore(s => s.deleteSnapshot)
  const [name, setName] = useState('')

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Snapshots</div>
            <div className="text-xs text-slate-400">Capture the current scenario + uploads as a reusable snapshot.</div>
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
            snapshots.map(snap => (
              <div key={snap.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{snap.name}</div>
                  <div className="text-xs text-slate-400">{new Date(snap.createdAt).toLocaleString()}</div>
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
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

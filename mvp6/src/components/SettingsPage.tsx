import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label } from './ui'

export function SettingsPage() {
  const defaults = useAppStore(s => s.defaults)
  const setDefaults = useAppStore(s => s.setDefaults)
  const [localDefaults, setLocalDefaults] = useState(defaults)

  const updateState = (state: 'NSW/QLD' | 'WA' | 'VIC', field: 'suggestedCbaPrice' | 'suggestedProgramPrice' | 'mriCostByState' | 'mriPatientByState', val: number) => {
    setLocalDefaults(prev => ({
      ...prev,
      [field]: { ...prev[field], [state]: val },
    }))
  }

  const save = () => {
    setDefaults(localDefaults)
  }

  const reset = () => {
    const resetDefaults = {
      suggestedCbaPrice: { 'NSW/QLD': 1325, WA: 1475, VIC: 925 },
      suggestedProgramPrice: { 'NSW/QLD': 10960, WA: 11110, VIC: 10560 },
      mriCostByState: { 'NSW/QLD': 380, WA: 750, VIC: 0 },
      mriPatientByState: { 'NSW/QLD': 400, WA: 770, VIC: 0 },
      doctorServiceFeePct: 15,
    }
    setLocalDefaults(resetDefaults)
    setDefaults(resetDefaults)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">Framework defaults</div>
            <div className="text-xs text-slate-400">Edit the preset values used by “Use framework defaults”.</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['NSW/QLD', 'WA', 'VIC'] as const).map(state => (
            <div key={state} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-200">{state}</div>
              <div>
                <Label>CBA price</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.suggestedCbaPrice[state]}
                  onChange={(e) => updateState(state, 'suggestedCbaPrice', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Program price</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.suggestedProgramPrice[state]}
                  onChange={(e) => updateState(state, 'suggestedProgramPrice', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>MRI cost (your cost)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.mriCostByState[state]}
                  onChange={(e) => updateState(state, 'mriCostByState', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>MRI patient fee</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.mriPatientByState[state]}
                  onChange={(e) => updateState(state, 'mriPatientByState', Number(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <Label>Doctor service fee retained (%)</Label>
            <Input
              className="mt-1"
              type="number"
              value={localDefaults.doctorServiceFeePct}
              onChange={(e) => setLocalDefaults({ ...localDefaults, doctorServiceFeePct: Number(e.target.value) })}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

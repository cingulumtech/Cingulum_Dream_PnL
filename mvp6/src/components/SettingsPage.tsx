import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label, Chip } from './ui'
import { RECOMMENDED_DEFAULTS } from '../lib/defaults'

export function SettingsPage() {
  const defaults = useAppStore(s => s.defaults)
  const setDefaults = useAppStore(s => s.setDefaults)
  const resetDefaults = useAppStore(s => s.resetDefaults)
  const [localDefaults, setLocalDefaults] = useState(defaults)
  const [savedState, setSavedState] = useState<'idle' | 'saved'>('idle')

  React.useEffect(() => {
    setLocalDefaults(defaults)
  }, [defaults])

  const updateState = (state: 'NSW/QLD' | 'WA' | 'VIC', field: 'suggestedCbaPrice' | 'suggestedProgramPrice' | 'mriCostByState' | 'mriPatientByState', val: number) => {
    setLocalDefaults(prev => ({
      ...prev,
      [field]: { ...prev[field], [state]: val },
    }))
  }

  const save = () => {
    setDefaults(localDefaults)
    setSavedState('saved')
    setTimeout(() => setSavedState('idle'), 1500)
  }

  const reset = () => {
    setLocalDefaults(RECOMMENDED_DEFAULTS)
    resetDefaults()
    setSavedState('saved')
    setTimeout(() => setSavedState('idle'), 1500)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">Pricing by state</div>
            <div className="text-xs text-slate-400">Suggests bundle prices + MRI defaults when you switch state in the scenario.</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Reset to recommended
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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(['NSW/QLD', 'WA', 'VIC'] as const).map(state => (
            <div key={state} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>{state}</span>
                <Chip className="px-2 py-0.5 h-6">{state === 'WA' ? 'Premium' : 'Baseline'}</Chip>
              </div>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold text-slate-100">Global defaults</div>
            <div className="text-xs text-slate-400">Used everywhere for doctor payouts.</div>
            <div className="mt-3">
              <Label>Doctor service fee retained (%)</Label>
              <Input
                className="mt-1"
                type="number"
                value={localDefaults.doctorServiceFeePct}
                onChange={(e) => setLocalDefaults({ ...localDefaults, doctorServiceFeePct: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Export settings</div>
                <div className="text-xs text-slate-400">Controls PDF size + margins for Saved Exports and Reports.</div>
              </div>
              <Chip className="px-2 py-1 h-7">Page layout</Chip>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Page size</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['a4', 'letter'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setLocalDefaults({ ...localDefaults, exportSettings: { ...localDefaults.exportSettings, pageSize: size } })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        localDefaults.exportSettings.pageSize === size
                          ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {size === 'a4' ? 'A4' : 'Letter'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Margins (mm)</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={4}
                  value={localDefaults.exportSettings.marginMm}
                  onChange={(e) =>
                    setLocalDefaults({
                      ...localDefaults,
                      exportSettings: { ...localDefaults.exportSettings, marginMm: Number(e.target.value) },
                    })
                  }
                />
                <div className="mt-1 text-[11px] text-slate-400">Clamped between 4mm and 1/3 of the page width.</div>
              </div>
              <div className="rounded-xl border border-indigo-400/10 bg-indigo-500/5 px-3 py-2 text-xs text-slate-200">
                <div className="font-semibold text-slate-100">Recommended</div>
                <div>A4 with 12mm margins keeps the preview flush with investor PDF output.</div>
              </div>
            </div>
          </div>
        </div>

        {savedState === 'saved' ? (
          <div className="text-xs text-emerald-200">Saved. Future scenarios, exports, and reports will use these defaults.</div>
        ) : null}
      </Card>
    </div>
  )
}

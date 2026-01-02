import React, { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../store/appStore'
import { applyBundledScenario, computeXeroTotals } from '../lib/dream/compute'
import { Card, Chip, Input, Label } from './ui'

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (b ?? 0), 0)
}

function avg(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0
}

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

function toNum(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function compileMatchers(matchers: string[], fallback?: RegExp[]) {
  const cleaned = (matchers ?? []).map(s => String(s || '').trim()).filter(Boolean)
  if (!cleaned.length) {
    if (!fallback || !fallback.length) return null
    try {
      return new RegExp(fallback.map(r => r.source).join('|'), 'i')
    } catch {
      return null
    }
  }
  // Treat each line as a substring match (escape regex chars).
  const pattern = cleaned.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

function OverviewTooltip({ active, payload, label, showScenario }: any) {
  if (!active || !payload || !payload.length) return null
  const byKey: Record<string, any> = {}
  for (const p of payload) {
    if (p?.dataKey) byKey[p.dataKey] = p
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl px-4 py-3">
      <div className="text-sm font-semibold text-slate-100">{label}</div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="font-semibold" style={{ color: byKey.current?.stroke ?? "#E2E8F0" }}>current</span>
          <span className="font-semibold" style={{ color: byKey.current?.stroke ?? "#F8FAFC" }}>{money(Number(byKey.current?.value ?? 0))}</span>
        </div>
        {showScenario && byKey.scenario && (
          <div className="flex items-center justify-between gap-6">
            <span className="font-semibold" style={{ color: byKey.scenario?.stroke ?? "#E2E8F0" }}>scenario</span>
            <span className="font-semibold" style={{ color: byKey.scenario?.stroke ?? "#F8FAFC" }}>{money(Number(byKey.scenario?.value ?? 0))}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function suggestedCbaPrice(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.suggestedCbaPrice[state]
}

function suggestedProgramPrice(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.suggestedProgramPrice[state]
}

function mriDefaultForState(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.mriCostByState[state]
}

function mriPatientForState(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.mriPatientByState[state]
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ' +
          (checked ? 'border-emerald-500/30 bg-emerald-500/25' : 'border-white/10 bg-white/5 hover:bg-white/10')
        }
      >
        <span
          className={
            'inline-block h-4 w-4 rounded-full bg-white/80 transition-transform ' +
            (checked ? 'translate-x-6' : 'translate-x-1')
          }
        />
      </button>
      {label ? <span className="text-xs font-semibold text-slate-100">{label}</span> : null}
    </div>
  )
}

function CostItem(props: {
  title: string
  subtitle?: string
  checked: boolean
  onChecked: (v: boolean) => void
  actual: number
  onActual: (n: number) => void
  patientFee: number
  onPatientFee: (n: number) => void
  toggleable?: boolean
  showPatientFee?: boolean
}) {
  const {
    title,
    subtitle,
    checked,
    onChecked,
    actual,
    onActual,
    patientFee,
    onPatientFee,
    toggleable = true,
    showPatientFee = true,
  } = props
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        {toggleable ? <ToggleSwitch checked={checked} onChange={onChecked} /> : null}
      </div>
      <div className={'mt-3 grid grid-cols-1 gap-3 ' + (showPatientFee ? 'sm:grid-cols-2' : '')}>
        {showPatientFee ? (
          <div>
            <Label>Patient fee (shown to patient)</Label>
            <Input
              className="mt-2"
              type="number"
              value={patientFee}
              onChange={(e) => onPatientFee(toNum(e.target.value))}
              disabled={toggleable ? !checked : false}
            />
          </div>
        ) : null}
        <div>
          <Label>Actual cost (your cost)</Label>
          <Input
            className="mt-2"
            type="number"
            value={actual}
            onChange={(e) => onActual(toNum(e.target.value))}
            disabled={toggleable ? !checked : false}
          />
        </div>
      </div>
    </div>
  )
}

function ConsultCostItem(props: {
  title: string
  subtitle?: string
  checked: boolean
  onChecked: (v: boolean) => void
  count: number
  onCount: (n: number) => void
  patientFee: number
  onPatientFee: (n: number) => void
  serviceFeePct: number
  patientCount: number
  patientLabel: string
  readOnly?: boolean
  note?: string
}) {
  const { title, subtitle, checked, onChecked, count, onCount, patientFee, onPatientFee, serviceFeePct, patientCount, patientLabel, readOnly = false, note } = props
  const payoutFactor = 1 - Math.min(1, Math.max(0, (serviceFeePct ?? 0) / 100))
  const actualPerConsult = (patientFee ?? 0) * payoutFactor
  const actualPerPatient = actualPerConsult * (count ?? 0)
  const perMonth = actualPerPatient * (patientCount ?? 0)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <ToggleSwitch checked={checked} onChange={onChecked} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Consults per patient</Label>
          <Input
            className="mt-2"
            type="number"
            value={count}
            onChange={(e) => onCount(toNum(e.target.value))}
            disabled={!checked || readOnly}
          />
        </div>
        <div>
          <Label>Patient fee per consult</Label>
          <Input
            className="mt-2"
            type="number"
            value={patientFee}
            onChange={(e) => onPatientFee(toNum(e.target.value))}
            disabled={!checked || readOnly}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          Actual payout per consult:{' '}
          <span className="font-semibold text-slate-100">{money(actualPerConsult)}</span>
          <span className="text-slate-400">(service fee {serviceFeePct}% retained)</span>
        </div>
        <div>
          Actual cost per patient (this line): <span className="font-semibold text-slate-100">{money(actualPerPatient)}</span>
        </div>
        <div className="text-slate-400">
          Monthly total at {patientLabel} {patientCount}: <span className="text-slate-200">{money(perMonth)}</span>
        </div>
        {note ? <div className="text-slate-400">{note}</div> : null}
      </div>
    </div>
  )
}

export function Overview() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const scenario = useAppStore(s => s.scenario)
  const setScenario = useAppStore(s => s.setScenario)
  const defaults = useAppStore(s => s.defaults)
  const [consultModalOpen, setConsultModalOpen] = useState(false)

  const baseTotals = useMemo(() => (pl ? computeXeroTotals(pl) : null), [pl])

  const derivedProgramCount = useMemo(() => {
    if (!scenario.machinesEnabled) return null
    const machines = Math.max(0, scenario.tmsMachines ?? 0)
    const perWeek = Math.max(0, scenario.patientsPerMachinePerWeek ?? 0)
    const util = Math.min(1, Math.max(0, scenario.utilisation ?? 0))
    const weeksPerMonth = Math.max(0, (scenario.weeksPerYear ?? 52) / 12)
    return machines * perWeek * weeksPerMonth * util
  }, [scenario.machinesEnabled, scenario.tmsMachines, scenario.patientsPerMachinePerWeek, scenario.utilisation, scenario.weeksPerYear])

  const baseRentLatest = useMemo(() => {
    if (!pl) return null
    const rx = compileMatchers(scenario.rentAccountMatchers ?? [], [/rent/i, /lease/i])
    if (!rx) return null
    let latest: number | null = null
    for (const a of pl.accounts) {
      if (a.section !== 'operating_expenses') continue
      if (!rx.test(a.name)) continue
      for (let i = pl.monthLabels.length - 1; i >= 0; i--) {
        const v = a.values[i] ?? 0
        if (v !== 0) {
          latest = v
          break
        }
      }
      if (latest != null) break
    }
    return latest
  }, [pl, scenario.rentAccountMatchers])

  const consultGroups = useMemo(() => {
    if (!gl) return []
    const rx = compileMatchers(scenario.legacyConsultAccountMatchers ?? [], [])
    if (!rx) return []
    const groups: Record<string, any> = {}
    for (const [idx, txn] of (gl.txns ?? []).entries()) {
      const label = `${txn.account ?? 'Unmapped'}`
      if (!rx.test(label) && !(txn.description && rx.test(txn.description))) continue
      if (!groups[label]) groups[label] = { account: label, txns: [] as any[] }
      const key = `${label}-${txn.date}-${txn.amount}-${txn.description ?? ''}-${idx}`
      groups[label].txns.push({ key, ...txn })
    }
    return Object.values(groups)
  }, [gl, scenario.legacyConsultAccountMatchers])

  const scenarioTotals = useMemo(() => {
    if (!pl || !baseTotals) return null
    if (!scenario.enabled) return null
    return applyBundledScenario(baseTotals, pl, scenario)
  }, [pl, baseTotals, scenario])

  if (!pl || !baseTotals) {
    return (
      <Card className="p-5">
        <div className="text-sm text-slate-300">
          Start by uploading a Profit &amp; Loss export. Then map accounts once, and the app becomes “decision-grade”.
        </div>
      </Card>
    )
  }

  const rows = pl.monthLabels.map((label, i) => {
    const row: any = {
      month: label,
      current: baseTotals.net[i] ?? 0,
    }
    if (scenario.enabled && scenarioTotals) row.scenario = scenarioTotals.net[i] ?? 0
    return row
  })

  const currentTotal = sum(baseTotals.net)
  const scenarioTotal = scenarioTotals ? sum(scenarioTotals.net) : null
  const delta = scenarioTotal == null ? 0 : scenarioTotal - currentTotal

  const best = (arr: number[]) => (arr.length ? Math.max(...arr) : 0)
  const worst = (arr: number[]) => (arr.length ? Math.min(...arr) : 0)

  const derivedProgramsRounded = derivedProgramCount != null ? Math.round(derivedProgramCount) : 0
  const effectivePrograms = scenario.machinesEnabled && derivedProgramCount != null ? derivedProgramsRounded : (scenario.programMonthlyCount ?? 0)
  const baseRentAvg = baseRentLatest ?? 0
  const programDisplayCount = scenario.machinesEnabled ? derivedProgramsRounded : (scenario.programMonthlyCount ?? 0)

  return (
    <>
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-100">Strategic Overview</div>
            <div className="text-sm text-slate-300 mt-1">
              “If we ran the business this way instead of the current way, what would actually change — and is it worth it?”
            </div>
          </div>
          {scenario.enabled ? (
            <Chip tone={delta >= 0 ? 'good' : 'bad'} className="shrink-0">
              Δ {money(delta)}
            </Chip>
          ) : (
            <Chip className="shrink-0">Scenario off</Chip>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-300">Current 12-mo profit</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">{money(currentTotal)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-300">Scenario 12-mo profit</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {scenarioTotal == null ? '—' : money(scenarioTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-300">Avg monthly profit (current)</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">{money(avg(baseTotals.net))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-300">Best / worst (current)</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {money(best(baseTotals.net))} / {money(worst(baseTotals.net))}
            </div>
          </div>
        </div>

        <div className="mt-4 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 12 }} width={70} />
              {/* Key forces a clean remount so disabled series never lingers in hover state */}
              <Tooltip
                key={scenario.enabled ? 'scenario-on' : 'scenario-off'}
                content={<OverviewTooltip showScenario={scenario.enabled && !!scenarioTotals} />}
              />
              <Line type="monotone" name="Current" dataKey="current" dot={false} strokeWidth={2} stroke="#38bdf8" />
              {scenario.enabled && (
                <Line type="monotone" name="Scenario" dataKey="scenario" dot={false} strokeWidth={2} stroke="#22c55e" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-indigo-400/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-indigo-900/40 p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Shifting the needle</div>
                <div className="text-xs text-slate-300 mt-1">
                  High-leverage levers that can swing profitability (without changing clinical volume).
                </div>
              </div>
              <Chip className="shrink-0">High leverage</Chip>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Rent</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Current rent is read from the uploaded P&amp;L (matched accounts). Scenario can override it.
                    </div>
                  </div>
                  <ToggleSwitch checked={scenario.rentEnabled} onChange={(v) => setScenario({ rentEnabled: v })} />
                </div>

                {scenario.rentEnabled ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Matched rent accounts</Label>
                      <textarea
                        className="mt-2 h-20 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                        value={(scenario.rentAccountMatchers ?? []).join('\n')}
                        onChange={(e) => setScenario({ rentAccountMatchers: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })}
                      />
                      <div className="mt-1 text-xs text-slate-300">
                        Avg matched rent (current): <span className="font-semibold text-slate-100">{money(baseRentAvg)}</span> / month
                      </div>
                    </div>
                    <div>
                      <Label>Mode</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setScenario({ rentMode: 'fixed' })}
                          className={
                            'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                            (scenario.rentMode === 'fixed'
                              ? 'border-white/20 bg-white/10 text-slate-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                          }
                        >
                          Fixed monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setScenario({ rentMode: 'percent' })}
                          className={
                            'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                            (scenario.rentMode === 'percent'
                              ? 'border-white/20 bg-white/10 text-slate-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                          }
                        >
                          Monthly % change
                        </button>
                      </div>

                      {scenario.rentMode === 'fixed' ? (
                        <div className="mt-3">
                          <Label>Scenario rent (per month)</Label>
                          <Input className="mt-2" type="number" value={scenario.rentFixedMonthly} onChange={(e) => setScenario({ rentFixedMonthly: toNum(e.target.value) })} />
                          <div className="mt-1 text-xs text-slate-300">
                            This replaces matched rent each month (scenario only).
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Label>Monthly change (%)</Label>
                          <Input
                            className="mt-2"
                            type="number"
                            value={scenario.rentPercentPerMonth}
                            onChange={(e) => setScenario({ rentPercentPerMonth: toNum(e.target.value) })}
                          />
                          <div className="mt-1 text-xs text-slate-300">
                            Compounded month-to-month (as displayed left→right in the chart).
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-300">Off = scenario keeps rent exactly as reported in the uploaded P&amp;L.</div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">TMS machine capacity</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Derive programs/month from machines, utilisation, and a conservative 4.33 weeks/month — or override manually.
                    </div>
                  </div>
                  <Chip tone={scenario.machinesEnabled ? 'good' : 'bad'} className="shrink-0">
                    {scenario.machinesEnabled ? 'Dynamic' : 'Manual override'}
                  </Chip>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setScenario({ machinesEnabled: true })}
                    className={
                      'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                      (scenario.machinesEnabled
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                    }
                  >
                    Dynamic (auto-adjust)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setScenario({
                        machinesEnabled: false,
                        programMonthlyCount: programDisplayCount || derivedProgramsRounded,
                      })
                    }
                    className={
                      'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                      (!scenario.machinesEnabled
                        ? 'border-amber-400/40 bg-amber-400/10 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                    }
                  >
                    Manual override
                  </button>
                </div>

                {scenario.machinesEnabled ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label>Machines</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={scenario.tmsMachines}
                          onChange={(e) => setScenario({ tmsMachines: toNum(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Patients / week / machine</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={scenario.patientsPerMachinePerWeek}
                          onChange={(e) => setScenario({ patientsPerMachinePerWeek: toNum(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Utilisation (%)</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={Math.round((scenario.utilisation ?? 0) * 100)}
                          onChange={(e) => setScenario({ utilisation: Math.min(1, Math.max(0, toNum(e.target.value) / 100)) })}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-slate-100">
                      Programs / month (auto): <span className="text-base font-semibold text-white">{derivedProgramsRounded}</span>
                      <div className="text-emerald-100/70">
                        Used throughout the scenario (consult payouts, program revenue, and COGS).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Label>Programs / month (manual)</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      value={scenario.programMonthlyCount}
                      onChange={(e) => setScenario({ programMonthlyCount: toNum(e.target.value) })}
                    />
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                      Manual override is active — auto capacity adjustments are paused until you switch back to Dynamic.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Bundled pricing scenario</div>
                <div className="text-xs text-slate-300 mt-1">
                  Replacement-based: remove legacy TMS (and optionally consult revenue), then add CBA + cgTMS bundle revenue. Costs are optional and explicit.
                </div>
              </div>
              <ToggleSwitch checked={scenario.enabled} onChange={(v) => setScenario({ enabled: v })} label="Enable" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Clinic state (sets MRI defaults)</Label>
                <select
                  value={scenario.state}
                  onChange={(e) => {
                    const st = e.target.value as any
                    const mriActual = mriDefaultForState(st, defaults)
                    const mriPatient = mriPatientForState(st, defaults)
                    setScenario({
                      state: st,
                      cbaMriCost: mriActual,
                      progMriCost: mriActual,
                      cbaMriPatientFee: mriPatient,
                      progMriPatientFee: mriPatient,
                      cbaPrice: suggestedCbaPrice(st, defaults),
                      programPrice: suggestedProgramPrice(st, defaults),
                    })
                  }}
                  className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="NSW/QLD">NSW / QLD</option>
                  <option value="WA">WA</option>
                  <option value="VIC">VIC</option>
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Cost treatment</div>
                    <div className="text-xs text-slate-300 mt-1">
                      If ON, we add per-patient bundle costs into scenario COGS (conservative). If OFF, the scenario changes revenue only and assumes costs already exist in the P&amp;L.
                    </div>
                  </div>
                  <ToggleSwitch checked={scenario.addBundleCostsToScenario} onChange={(v) => setScenario({ addBundleCostsToScenario: v })} />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>Legacy TMS revenue matchers (one per line)</Label>
              <textarea
                className="mt-2 w-full min-h-[78px] rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={(scenario.legacyTmsAccountMatchers ?? []).join('\n')}
                onChange={(e) =>
                  setScenario({
                    legacyTmsAccountMatchers: e.target.value
                      .split(/\r?\n/)
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={'tms\ncgtms\nrTMS\ntranscranial'}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Consults in bundle</div>
                  <div className="text-xs text-slate-300 mt-1">
                    If consults are billed inside the bundle, turn this ON so existing consult revenue is removed (no double counting).
                  </div>
                </div>
                <ToggleSwitch checked={scenario.includeDoctorConsultsInBundle} onChange={(v) => setScenario({ includeDoctorConsultsInBundle: v })} />
              </div>
              {scenario.includeDoctorConsultsInBundle && (
                <div className="mt-4">
                  <Label>Consult revenue account matchers (advanced)</Label>
                  <textarea
                    className="mt-2 w-full min-h-[72px] rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={(scenario.legacyConsultAccountMatchers ?? []).join('\n')}
                    onChange={(e) =>
                      setScenario({
                        legacyConsultAccountMatchers: e.target.value
                          .split(/\r?\n/)
                          .map(s => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder={'consult\nappointment\ndr\ndoctor'}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <button
                      type="button"
                      onClick={() => setConsultModalOpen(true)}
                      className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-indigo-500/15"
                    >
                      Review &amp; exclude consult transactions
                    </button>
                    <span>
                      Excluded accounts: {(scenario.excludedConsultAccounts ?? []).length} · Excluded txns:{' '}
                      {(scenario.excludedConsultTxnKeys ?? []).length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bundle streams */}
            {(() => {
              const mriDefault = mriDefaultForState(scenario.state, defaults)
              const svcFactor = 1 - Math.min(1, Math.max(0, (scenario.doctorServiceFeePct ?? 0) / 100))
              const cbaConsultActual = (scenario.cbaInitialConsultFee ?? 0) * svcFactor * (scenario.cbaInitialConsultCount ?? 0)
              const cbaIncluded =
                (scenario.cbaIncludeMRI ? (scenario.cbaMriCost ?? mriDefault) : 0) +
                (scenario.cbaIncludeQuicktome ? (scenario.cbaQuicktomeCost ?? 0) : 0) +
                (scenario.cbaIncludeCreyos ? (scenario.cbaCreyosCost ?? 0) : 0) +
                (scenario.cbaIncludeInitialConsult ? cbaConsultActual : 0) +
                (scenario.cbaOtherCogsPerAssessment ?? 0)

              const wkActual = (scenario.prog6WkConsultFee ?? 0) * svcFactor * (scenario.prog6WkConsultCount ?? 0)
              const moActual = wkActual // 6-month follow-up mirrors 6-week count + fee
              const progIncluded =
                (scenario.progIncludePostMRI ? (scenario.progMriCost ?? mriDefault) : 0) +
                (scenario.progIncludeQuicktome ? (scenario.progQuicktomeCost ?? 0) : 0) +
                (scenario.progInclude6WkConsult ? wkActual : 0) +
                (scenario.progInclude6WkConsult ? moActual : 0) +
                (scenario.progIncludeAdjunctAllowance ? (scenario.progAdjunctAllowance ?? 0) : 0) +
                (scenario.progTreatmentDeliveryCost ?? 0) +
                (scenario.progOtherCogsPerProgram ?? 0)

              const cbaApplied = scenario.addBundleCostsToScenario ? cbaIncluded : 0
              const progApplied = scenario.addBundleCostsToScenario ? progIncluded : 0

              return (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">CBA bundle</div>
                        <div className="text-xs text-slate-300 mt-1">Pre-treatment work-up to cover assessment costs (even if they don’t proceed).</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const st = scenario.state
                          const mri = mriDefaultForState(st, defaults)
                          setScenario({
                            cbaPrice: suggestedCbaPrice(st, defaults),
                            cbaIncludeMRI: true,
                            cbaMriCost: mri,
                            cbaMriPatientFee: mriPatientForState(st, defaults),
                            cbaIncludeQuicktome: true,
                            cbaQuicktomeCost: 200,
                            cbaQuicktomePatientFee: 200,
                            cbaIncludeCreyos: true,
                            cbaCreyosCost: 75,
                            cbaCreyosPatientFee: 75,
                            cbaIncludeInitialConsult: true,
                            cbaInitialConsultFee: 650,
                            cbaInitialConsultCount: 1,
                          })
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Use framework defaults
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label>CBA assessments / month</Label>
                        <Input className="mt-2" type="number" value={scenario.cbaMonthlyCount} onChange={(e) => setScenario({ cbaMonthlyCount: toNum(e.target.value) })} />
                      </div>
                      <div>
                        <Label>CBA price (revenue)</Label>
                        <Input className="mt-2" type="number" value={scenario.cbaPrice} onChange={(e) => setScenario({ cbaPrice: toNum(e.target.value) })} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CostItem
                        title="MRI"
                        subtitle="Radiology"
                        checked={scenario.cbaIncludeMRI}
                        onChecked={(v) => setScenario({ cbaIncludeMRI: v })}
                        patientFee={scenario.cbaMriPatientFee}
                        onPatientFee={(n) => setScenario({ cbaMriPatientFee: n })}
                        actual={scenario.cbaMriCost}
                        onActual={(n) => setScenario({ cbaMriCost: n })}
                      />
                      <CostItem
                        title="Quicktome"
                        subtitle="Processing"
                        checked={scenario.cbaIncludeQuicktome}
                        onChecked={(v) => setScenario({ cbaIncludeQuicktome: v })}
                        patientFee={scenario.cbaQuicktomePatientFee}
                        onPatientFee={(n) => setScenario({ cbaQuicktomePatientFee: n })}
                        actual={scenario.cbaQuicktomeCost}
                        onActual={(n) => setScenario({ cbaQuicktomeCost: n })}
                      />
                      <CostItem
                        title="Creyos"
                        subtitle="Assessment"
                        checked={scenario.cbaIncludeCreyos}
                        onChecked={(v) => setScenario({ cbaIncludeCreyos: v })}
                        patientFee={scenario.cbaCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ cbaCreyosPatientFee: n })}
                        actual={scenario.cbaCreyosCost}
                        onActual={(n) => setScenario({ cbaCreyosCost: n })}
                      />
                      <ConsultCostItem
                        title="Initial consult"
                        subtitle="Doctor"
                        checked={scenario.cbaIncludeInitialConsult}
                        onChecked={(v) => setScenario({ cbaIncludeInitialConsult: v })}
                        count={scenario.cbaInitialConsultCount}
                        onCount={(n) => setScenario({ cbaInitialConsultCount: n })}
                        patientFee={scenario.cbaInitialConsultFee}
                        onPatientFee={(n) => setScenario({ cbaInitialConsultFee: n })}
                        patientCount={scenario.cbaMonthlyCount ?? 0}
                        patientLabel="CBA / month"
                      />
                      <CostItem
                        title="Other assessment COGS"
                        subtitle="Optional"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.cbaOtherCogsPerAssessment}
                        onActual={(n) => setScenario({ cbaOtherCogsPerAssessment: n })}
                        showPatientFee={false}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-slate-300">
                        Included costs / CBA: <span className="font-semibold text-slate-100">{money(cbaIncluded)}</span>
                        <span className="text-slate-400"> · applied to scenario: {scenario.addBundleCostsToScenario ? 'yes' : 'no'}</span>
                      </div>
                      <div className="text-slate-300">
                        Gross margin / CBA: <span className="font-semibold text-slate-100">{money((scenario.cbaPrice ?? 0) - cbaIncluded)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">cgTMS bundle</div>
                        <div className="text-xs text-slate-300 mt-1">Treatment + (optional) therapies + follow-ups.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const st = scenario.state
                          const mri = mriDefaultForState(st, defaults)
                          setScenario({
                            programPrice: suggestedProgramPrice(st, defaults),
                            progIncludePostMRI: true,
                            progMriCost: mri,
                            progMriPatientFee: mriPatientForState(st, defaults),
                            progMriPatientFee: mriPatientForState(st),
                            progIncludeQuicktome: true,
                            progQuicktomeCost: 200,
                            progQuicktomePatientFee: 200,
                            progIncludeCreyos: true,
                            progCreyosCost: 75,
                            progCreyosPatientFee: 75,
                            progInclude6WkConsult: true,
                            prog6WkConsultFee: 450,
                            prog6WkConsultCount: 1,
                            progIncludeAdjunctAllowance: true,
                            progAdjunctAllowance: 560,
                            progInclude6MoConsult: true,
                            prog6MoConsultFee: 450,
                            prog6MoConsultCount: 1,
                            progInclude6MoCreyos: true,
                            prog6MoCreyosCost: 75,
                            prog6MoCreyosPatientFee: 75,
                          })
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Use framework defaults
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="flex items-center justify-between gap-2">
                          Programs / month
                          <Chip tone={scenario.machinesEnabled ? 'good' : 'bad'} className="h-6 px-2">
                            {scenario.machinesEnabled ? 'Auto' : 'Manual'}
                          </Chip>
                        </Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={programDisplayCount}
                          onChange={(e) => setScenario({ programMonthlyCount: toNum(e.target.value) })}
                          disabled={scenario.machinesEnabled}
                        />
                        <div className="mt-1 text-xs text-slate-300">
                          {scenario.machinesEnabled && derivedProgramCount != null ? (
                            <>
                              Derived from capacity:{' '}
                              <span className="font-semibold text-slate-100">{derivedProgramsRounded}</span> programs / month (set above).
                            </>
                          ) : (
                            'Manual override in use — switch to Dynamic above to auto-adjust.'
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>cgTMS price (revenue)</Label>
                        <Input className="mt-2" type="number" value={scenario.programPrice} onChange={(e) => setScenario({ programPrice: toNum(e.target.value) })} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CostItem
                        title="Post MRI"
                        subtitle="Radiology"
                        checked={scenario.progIncludePostMRI}
                        onChecked={(v) => setScenario({ progIncludePostMRI: v })}
                        patientFee={scenario.progMriPatientFee}
                        onPatientFee={(n) => setScenario({ progMriPatientFee: n })}
                        actual={scenario.progMriCost}
                        onActual={(n) => setScenario({ progMriCost: n })}
                      />
                      <CostItem
                        title="Quicktome"
                        subtitle="Processing"
                        checked={scenario.progIncludeQuicktome}
                        onChecked={(v) => setScenario({ progIncludeQuicktome: v })}
                        patientFee={scenario.progQuicktomePatientFee}
                        onPatientFee={(n) => setScenario({ progQuicktomePatientFee: n })}
                        actual={scenario.progQuicktomeCost}
                        onActual={(n) => setScenario({ progQuicktomeCost: n })}
                      />
                      <CostItem
                        title="Creyos"
                        subtitle="Assessment"
                        checked={scenario.progIncludeCreyos}
                        onChecked={(v) => setScenario({ progIncludeCreyos: v })}
                        patientFee={scenario.progCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ progCreyosPatientFee: n })}
                        actual={scenario.progCreyosCost}
                        onActual={(n) => setScenario({ progCreyosCost: n })}
                      />
                      <ConsultCostItem
                        title="6-week consult"
                        subtitle="Doctor"
                        checked={scenario.progInclude6WkConsult}
                        onChecked={(v) => setScenario({ progInclude6WkConsult: v })}
                        count={scenario.prog6WkConsultCount}
                        onCount={(n) => setScenario({ prog6WkConsultCount: n })}
                        patientFee={scenario.prog6WkConsultFee}
                        onPatientFee={(n) => setScenario({ prog6WkConsultFee: n })}
                        patientCount={effectivePrograms}
                        patientLabel="Programs / month"
                      />
                      <CostItem
                        title="Adjunct allowance"
                        subtitle="Therapies"
                        checked={scenario.progIncludeAdjunctAllowance}
                        onChecked={(v) => setScenario({ progIncludeAdjunctAllowance: v })}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progAdjunctAllowance}
                        onActual={(n) => setScenario({ progAdjunctAllowance: n })}
                        showPatientFee={false}
                      />
                      <ConsultCostItem
                        title="6-month consult"
                        subtitle="Doctor"
                        checked={scenario.progInclude6MoConsult}
                        onChecked={(v) => setScenario({ progInclude6MoConsult: v })}
                        count={scenario.prog6MoConsultCount}
                        onCount={(n) => setScenario({ prog6MoConsultCount: n })}
                        patientFee={scenario.prog6MoConsultFee}
                        onPatientFee={(n) => setScenario({ prog6MoConsultFee: n })}
                        patientCount={effectivePrograms}
                        patientLabel="Programs / month"
                      />
                      <CostItem
                        title="6-month Creyos"
                        subtitle="Assessment"
                        checked={scenario.progInclude6MoCreyos}
                        onChecked={(v) => setScenario({ progInclude6MoCreyos: v })}
                        patientFee={scenario.prog6MoCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ prog6MoCreyosPatientFee: n })}
                        actual={scenario.prog6MoCreyosCost}
                        onActual={(n) => setScenario({ prog6MoCreyosCost: n })}
                      />
                      <CostItem
                        title="Treatment delivery"
                        subtitle="Unmodelled cost"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progTreatmentDeliveryCost}
                        onActual={(n) => setScenario({ progTreatmentDeliveryCost: n })}
                        showPatientFee={false}
                      />
                      <CostItem
                        title="Other program COGS"
                        subtitle="Optional"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progOtherCogsPerProgram}
                        onActual={(n) => setScenario({ progOtherCogsPerProgram: n })}
                        showPatientFee={false}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-slate-300">
                        Included costs / program: <span className="font-semibold text-slate-100">{money(progIncluded)}</span>
                        <span className="text-slate-400"> · applied to scenario: {scenario.addBundleCostsToScenario ? 'yes' : 'no'}</span>
                      </div>
                      <div className="text-slate-300">
                        Gross margin / program: <span className="font-semibold text-slate-100">{money((scenario.programPrice ?? 0) - progIncluded)}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                      Scenario calculation (monthly):
                      <div className="mt-1 text-slate-200">
                        Δ revenue = CBA×{money(scenario.cbaPrice ?? 0)} + Program×{money(scenario.programPrice ?? 0)}
                      </div>
                      <div className="text-slate-200">
                        Δ COGS = {scenario.addBundleCostsToScenario ? `CBA×${money(cbaApplied)} + Program×${money(progApplied)}` : '0 (costs assumed already in P&L)'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
            <div className="mt-4 text-xs text-slate-400">
              Next iteration: plug scenario revenue into the Dream lines (so you can drill down into assumptions the same way it drills into GL).
            </div>
          </div>
      </Card>
    </div>
    {consultModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
        <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Consult transaction review</div>
              <div className="text-xs text-slate-400">Group by Xero account. Exclude whole accounts or individual txns.</div>
            </div>
            <button
              type="button"
              onClick={() => setConsultModalOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-4 max-h-[60vh] overflow-auto space-y-3">
            {consultGroups.length === 0 ? (
              <div className="text-xs text-slate-300">No consult transactions matched the current regex.</div>
            ) : (
              consultGroups.map(group => {
                const excludedAcc = (scenario.excludedConsultAccounts ?? []).includes(group.account)
                return (
                  <div key={group.account} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{group.account}</div>
                        <div className="text-xs text-slate-400">{group.txns.length} transactions</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const set = new Set(scenario.excludedConsultAccounts ?? [])
                          excludedAcc ? set.delete(group.account) : set.add(group.account)
                          setScenario({ excludedConsultAccounts: Array.from(set) })
                        }}
                        className={`rounded-xl px-3 py-1 text-xs font-semibold border ${
                          excludedAcc
                            ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                            : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                        }`}
                      >
                        {excludedAcc ? 'Include account' : 'Exclude account'}
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.txns.map((txn: any) => {
                        const excludedKeySet = new Set(scenario.excludedConsultTxnKeys ?? [])
                        const isExcluded = excludedKeySet.has(txn.key)
                        return (
                          <div key={txn.key} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold">{txn.description || '(no description)'}</div>
                                <div className="text-slate-400">{txn.date}</div>
                                <div className="text-slate-300">Amount: {money(txn.amount)}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = new Set(scenario.excludedConsultTxnKeys ?? [])
                                  isExcluded ? next.delete(txn.key) : next.add(txn.key)
                                  setScenario({ excludedConsultTxnKeys: Array.from(next) })
                                }}
                                className={`rounded-lg px-2 py-1 border text-[11px] font-semibold ${
                                  isExcluded
                                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                                    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                                }`}
                              >
                                {isExcluded ? 'Include' : 'Exclude'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

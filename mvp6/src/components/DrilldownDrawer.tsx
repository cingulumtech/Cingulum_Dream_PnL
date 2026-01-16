import React, { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { computeDream } from '../lib/dream/compute'
import { DreamGroup, DreamLine, TxnTreatment } from '../lib/types'
import { Button, Chip, Input, Label, Mono } from './ui'
import { api } from '../lib/api'
import { buildTxnHash, inferDoctorLabel, monthKeyFromDate, resolveTreatment } from '../lib/ledger'
import { createCopyMenuItems, useContextMenu } from './ContextMenu'
import { CopyAffordance } from './CopyAffordance'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const TREATMENT_OPTIONS: { value: TxnTreatment; label: string }[] = [
  { value: 'OPERATING', label: 'Operating' },
  { value: 'NON_OPERATING', label: 'Non-operating' },
  { value: 'DEFERRED', label: 'Deferred' },
  { value: 'EXCLUDE', label: 'Exclude' },
]

function flattenLines(node: DreamGroup, out: DreamLine[] = []) {
  for (const child of node.children) {
    if (child.kind === 'line') out.push(child)
    else flattenLines(child, out)
  }
  return out
}

export function DrilldownDrawer() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const template = useAppStore(s => s.template)
  const selectedId = useAppStore(s => s.selectedLineId)
  const setSelectedId = useAppStore(s => s.setSelectedLineId)
  const txnOverrides = useAppStore(s => s.txnOverrides)
  const doctorRules = useAppStore(s => s.doctorRules)
  const upsertTxnOverride = useAppStore(s => s.upsertTxnOverride)
  const removeTxnOverride = useAppStore(s => s.removeTxnOverride)
  const { openMenu, pushToast } = useContextMenu()
  const prefersReducedMotion = useReducedMotion()

  const [monthIdx, setMonthIdx] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [showExcluded, setShowExcluded] = useState(false)

  const lines = useMemo(() => flattenLines(template.root), [template])
  const selected = useMemo(() => {
    if (!selectedId) return null
    if (selectedId.startsWith('__acc__:')) return { kind: 'account' as const, account: selectedId.replace('__acc__:', '') }
    const ln = lines.find(l => l.id === selectedId)
    return ln ? ({ kind: 'line' as const, line: ln }) : null
  }, [selectedId, lines])

  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])
  const months = pl?.monthLabels ?? []
  const monthKey = monthIdx != null ? pl?.months?.[monthIdx] : null

  const mappedAccounts = useMemo(() => {
    if (!selected) return []
    if (selected.kind === 'account') return [selected.account]
    return selected.line.mappedAccounts
  }, [selected])

  const overrideMap = useMemo(() => {
    const map = new Map<string, any>()
    txnOverrides.forEach(o => {
      if (o.hash) map.set(o.hash, o)
    })
    return map
  }, [txnOverrides])

  const ruleMap = useMemo(() => {
    const map = new Map<string, any>()
    doctorRules.forEach(r => {
      if (r.enabled) map.set(r.contact_id, r)
    })
    return map
  }, [doctorRules])

  const txns = useMemo(() => {
    if (!gl || !mappedAccounts.length) return []
    const needle = q.toLowerCase()
    return gl.txns
      .filter(t => mappedAccounts.includes(t.account))
      .filter(t => {
        if (!monthKey) return true
        return t.date.startsWith(monthKey) // YYYY-MM
      })
      .filter(t => {
        if (!needle) return true
        return (
          t.account.toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle) ||
          (t.reference ?? '').toLowerCase().includes(needle) ||
          (t.source ?? '').toLowerCase().includes(needle)
        )
      })
      .map(t => {
        const hash = buildTxnHash(t)
        const doctorLabel = inferDoctorLabel(t)
        const doctorContactId = doctorLabel ? doctorLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null
        const override = overrideMap.get(hash)
        const rule = doctorContactId ? ruleMap.get(doctorContactId) : null
        const resolved = resolveTreatment({ txn: t, override, rule })
        return { ...t, hash, override, rule, resolved }
      })
      .filter(t => (showExcluded ? true : t.resolved.treatment !== 'EXCLUDE'))
      .slice(0, 800)
  }, [gl, mappedAccounts, monthKey, q, overrideMap, ruleMap, showExcluded])

  const txnTotal = useMemo(() => txns.reduce((sum, t) => sum + (t.amount ?? 0), 0), [txns])

  const saveOverride = async (txn: any, treatment: TxnTreatment, deferral?: { startMonth?: string; months?: number; includeInOperatingKPIs?: boolean }) => {
    const hash = txn.hash ?? buildTxnHash(txn)
    const payload = {
      source: 'XERO_GL',
      document_id: txn.reference ?? hash,
      line_item_id: null,
      hash,
      treatment,
      deferral_start_month: deferral?.startMonth ?? null,
      deferral_months: deferral?.months ?? null,
      deferral_include_in_operating_kpis: deferral?.includeInOperatingKPIs ?? null,
    }
    const saved = await api.upsertTxnOverride(payload)
    upsertTxnOverride(saved)
  }

  const clearOverride = async (overrideId: string) => {
    await api.deleteTxnOverride(overrideId)
    removeTxnOverride(overrideId)
  }

  return (
    <AnimatePresence>
      {selectedId && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedId(null)} />
          <motion.div
            className="absolute right-0 top-0 h-full w-full max-w-[520px] glass shadow-glass border-l border-white/10"
            initial={{ x: prefersReducedMotion ? 0 : 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: prefersReducedMotion ? 0 : 24, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
        <div className="p-4 flex items-start justify-between gap-3 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">
              {selected?.kind === 'account' ? selected.account : selected?.line.label ?? 'Details'}
            </div>
            <div className="text-xs text-slate-300">
              {selected?.kind === 'line'
                ? `${mappedAccounts.length} mapped Xero accounts`
                : 'Xero account (Legacy P&L)'}
            </div>
          </div>
          <Button variant="ghost" onClick={() => setSelectedId(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 overflow-auto h-[calc(100%-64px)]">
          {!gl && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Load the <span className="font-semibold">General Ledger Detail</span> export to enable transaction drill-down.
            </div>
          )}

          {selected?.kind === 'line' && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Label>Mapped accounts</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {mappedAccounts.length === 0 && <Chip>Unmapped</Chip>}
                {mappedAccounts.map(a => (
                  <Chip key={a}>{a}</Chip>
                ))}
              </div>
            </div>
          )}

          {gl && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">Transactions</div>
                <div className="flex items-center gap-2">
                  <Chip>{txns.length.toLocaleString()}</Chip>
                  <div
                    className="group relative rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                    onContextMenu={(event) =>
                      openMenu({
                        event,
                        items: createCopyMenuItems({
                          label: 'Transaction total',
                          value: txnTotal.toString(),
                          formatted: txnTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                          onCopied: () => pushToast('Copied'),
                        }),
                        title: 'Transaction total',
                      })
                    }
                  >
                    Total {txnTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    <span className="absolute right-1 top-1">
                      <CopyAffordance label="Transaction total" value={txnTotal.toString()} formatted={txnTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showExcluded} onChange={() => setShowExcluded(v => !v)} />
                    Show excluded
                  </label>
                </div>
                <div>
                  <Label>Month filter</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Chip
                      className={`cursor-pointer ${monthIdx == null ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                      onClick={() => setMonthIdx(null)}
                    >
                      All months
                    </Chip>
                    {months.map((m, i) => (
                      <Chip
                        key={m}
                        className={`cursor-pointer ${monthIdx === i ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                        onClick={() => setMonthIdx(i)}
                      >
                        {m}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Search</Label>
                  <Input value={q} onChange={e => setQ(e.target.value)} placeholder="description, reference, source..." />
                </div>
              </div>

              <div className="mt-4 overflow-auto max-h-[420px] rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Source</th>
                      <th className="text-left px-3 py-2 font-semibold">Description</th>
                      <th className="text-left px-3 py-2 font-semibold">Treatment</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t, i) => (
                      <React.Fragment key={i}>
                        <tr className="border-t border-white/10">
                        <td className="px-3 py-2 whitespace-nowrap"><Mono>{t.date}</Mono></td>
                        <td className="px-3 py-2 text-slate-300">{t.source ?? '-'}</td>
                        <td className="px-3 py-2">
                          <div className="text-slate-100">{t.description ?? '-'}</div>
                          {t.reference && <div className="text-xs text-slate-400">Ref: {t.reference}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <select
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                              value={t.resolved.treatment}
                              onChange={(e) => {
                                const next = e.target.value as TxnTreatment
                                const defaultMonth = monthKeyFromDate(t.date)
                                if (next === 'DEFERRED') {
                                  saveOverride(t, next, {
                                    startMonth: defaultMonth,
                                    months: t.resolved.deferral?.months ?? 12,
                                    includeInOperatingKPIs: t.resolved.deferral?.includeInOperatingKPIs ?? true,
                                  })
                                } else {
                                  saveOverride(t, next)
                                }
                              }}
                            >
                              {TREATMENT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {t.override && (
                              <button
                                type="button"
                                onClick={() => clearOverride(t.override.id)}
                                className="text-[10px] text-slate-400 hover:text-slate-200"
                              >
                                Revert to default
                              </button>
                            )}
                          </div>
                        </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums group"
                        onContextMenu={(event) =>
                          openMenu({
                            event,
                            items: createCopyMenuItems({
                              label: 'Amount',
                              value: t.amount.toString(),
                              formatted: t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                              onCopied: () => pushToast('Copied'),
                            }),
                            title: 'Amount',
                          })
                        }
                      >
                        <div className="flex items-center justify-end gap-2">
                          {t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          <CopyAffordance label="Amount" value={t.amount.toString()} formatted={t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                        </div>
                      </td>
                    </tr>
                      {t.resolved.treatment === 'DEFERRED' && (
                        <tr className="border-t border-white/10 bg-white/5 text-xs text-slate-300">
                          <td className="px-3 py-2" colSpan={5}>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2">
                                Start month
                                <input
                                  type="month"
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                                  value={t.resolved.deferral?.startMonth ?? monthKeyFromDate(t.date)}
                                  onChange={(e) =>
                                    saveOverride(t, t.resolved.treatment, {
                                      startMonth: e.target.value,
                                      months: t.resolved.deferral?.months ?? 12,
                                      includeInOperatingKPIs: t.resolved.deferral?.includeInOperatingKPIs ?? true,
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center gap-2">
                                Months
                                <input
                                  type="number"
                                  min={1}
                                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                                  value={t.resolved.deferral?.months ?? 12}
                                  onChange={(e) =>
                                    saveOverride(t, t.resolved.treatment, {
                                      startMonth: t.resolved.deferral?.startMonth ?? monthKeyFromDate(t.date),
                                      months: Number(e.target.value),
                                      includeInOperatingKPIs: t.resolved.deferral?.includeInOperatingKPIs ?? true,
                                    })
                                  }
                                />
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={t.resolved.deferral?.includeInOperatingKPIs ?? true}
                                  onChange={(e) =>
                                    saveOverride(t, t.resolved.treatment, {
                                      startMonth: t.resolved.deferral?.startMonth ?? monthKeyFromDate(t.date),
                                      months: t.resolved.deferral?.months ?? 12,
                                      includeInOperatingKPIs: e.target.checked,
                                    })
                                  }
                                />
                                Include in operating KPIs
                              </label>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                    {txns.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                          No transactions match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-slate-400">
                Note: for very large GL exports, this view caps to 800 rows for responsiveness.
              </div>
            </div>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

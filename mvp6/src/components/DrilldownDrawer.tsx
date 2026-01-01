import React, { useMemo, useState } from 'react'
import { X, Calendar, Filter } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { computeDream } from '../lib/dream/compute'
import { DreamGroup, DreamLine } from '../lib/types'
import { Button, Chip, Input, Label, Mono } from './ui'

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

  const [monthIdx, setMonthIdx] = useState<number | null>(null)
  const [q, setQ] = useState('')

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
      .slice(0, 800)
  }, [gl, mappedAccounts, monthKey, q])

  if (!selectedId) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedId(null)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] glass shadow-glass border-l border-white/10">
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
                <Chip>{txns.length.toLocaleString()}</Chip>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3">
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
                  <Input value={q} onChange={e => setQ(e.target.value)} placeholder="description, reference, source…" />
                </div>
              </div>

              <div className="mt-4 overflow-auto max-h-[420px] rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Source</th>
                      <th className="text-left px-3 py-2 font-semibold">Description</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t, i) => (
                      <tr key={i} className="border-t border-white/10">
                        <td className="px-3 py-2 whitespace-nowrap"><Mono>{t.date}</Mono></td>
                        <td className="px-3 py-2 text-slate-300">{t.source ?? '—'}</td>
                        <td className="px-3 py-2">
                          <div className="text-slate-100">{t.description ?? '—'}</div>
                          {t.reference && <div className="text-xs text-slate-400">Ref: {t.reference}</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
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
      </div>
    </div>
  )
}

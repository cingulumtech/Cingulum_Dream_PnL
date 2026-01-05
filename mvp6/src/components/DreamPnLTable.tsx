import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { computeDepAmort, computeDream, computeDreamTotals, computeXeroTotals } from '../lib/dream/compute'
import { DreamGroup, DreamLine } from '../lib/types'
import { Button, Card, Chip, Input } from './ui'
import { formatCurrency, formatPercent } from '../lib/format'
import { DataHealthSummary } from './DataHealthSummary'

function Row({
  node,
  depth,
  months,
  getVals,
  onSelect,
  expanded,
  toggle,
  coveragePct,
}: {
  node: DreamGroup | DreamLine
  depth: number
  months: number
  getVals: (id: string) => number[]
  onSelect: (id: string) => void
  expanded: Set<string>
  toggle: (id: string) => void
  coveragePct: (id: string) => number
}) {
  const isGroup = node.kind === 'group'
  const pad = 12 + depth * 14
  const vals = isGroup ? null : getVals(node.id)
  const coverage = isGroup || !vals ? null : coveragePct(node.id)

  return (
    <>
      <tr
        className="border-t border-white/10 hover:bg-white/5 cursor-pointer focus-within:bg-white/5"
        onClick={() => (isGroup ? toggle(node.id) : onSelect(node.id))}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            isGroup ? toggle(node.id) : onSelect(node.id)
          }
        }}
      >
        <td className="px-3 py-2" style={{ paddingLeft: pad }}>
          <div className="flex items-center gap-2">
            {isGroup ? (
              expanded.has(node.id) ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />
            ) : (
              <span className="h-4 w-4" />
            )}
            <div className={isGroup ? 'font-semibold text-slate-100' : 'text-slate-100'}>{node.label}</div>
            {!isGroup && (
              <div className="ml-auto flex items-center gap-2">
                <Chip className="whitespace-nowrap">
                  {node.mappedAccounts?.length ?? 0} mapped · {coverage !== null ? formatPercent(coverage, { maximumFractionDigits: 1 }) : '0%'}
                </Chip>
                {(node.mappedAccounts?.length ?? 0) === 0 && <Chip className="whitespace-nowrap" tone="bad">Unmapped</Chip>}
              </div>
            )}
          </div>
        </td>
        {Array.from({ length: months }).map((_, i) => (
          <td key={i} className="px-3 py-2 text-right tabular-nums">
            {isGroup ? <span className="text-slate-500">—</span> : (vals?.[i] ?? 0) === 0 ? <span className="text-slate-500">—</span> : formatCurrency(vals?.[i] ?? 0)}
          </td>
        ))}
      </tr>

      {isGroup &&
        expanded.has(node.id) &&
        node.children.map(child => (
          <Row
            key={child.id}
            node={child}
            depth={depth + 1}
            months={months}
            getVals={getVals}
            onSelect={onSelect}
            expanded={expanded}
            toggle={toggle}
            coveragePct={coveragePct}
          />
        ))}
    </>
  )
}

export function DreamPnLTable() {
  const pl = useAppStore(s => s.pl)
  const template = useAppStore(s => s.template)
  const setSelectedLineId = useAppStore(s => s.setSelectedLineId)
  const setView = useAppStore(s => s.setView)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['rev', 'cogs', 'opex']))
  const [showReconciliation, setShowReconciliation] = useState(false)

  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])
  const totals = useMemo(() => (pl && computed ? computeDreamTotals(pl, template, computed) : null), [pl, template, computed])
  const legacyTotals = useMemo(() => (pl ? computeXeroTotals(pl) : null), [pl])

  const depAmort = useMemo(() => (pl ? computeDepAmort(pl) : []), [pl])

  const hasAnyMapping = useMemo(() => {
    const walk = (n: any): boolean => {
      if (!n) return false
      if (n.kind === "line") return (n.mappedAccounts?.length ?? 0) > 0
      return Array.isArray(n.children) && n.children.some(walk)
    }
    return walk(template.root)
  }, [template])

  const mappedAccountSet = useMemo(() => {
    const set = new Set<string>()
    const walk = (node: DreamGroup) => {
      for (const child of node.children) {
        if (child.kind === 'line') child.mappedAccounts.forEach(a => set.add(a))
        else walk(child)
      }
    }
    walk(template.root)
    return set
  }, [template])

  const unmappedAccountNames = useMemo(() => {
    if (!pl) return []
    return pl.accounts.map(a => a.name).filter(name => !mappedAccountSet.has(name))
  }, [pl, mappedAccountSet])

  const mappedTotals = useMemo(() => {
    if (!pl) return null
    const blank = () => Array(pl.months.length).fill(0)
    const mapped = { revenue: blank(), cogs: blank(), opex: blank() }

    for (const acc of pl.accounts) {
      if (!mappedAccountSet.has(acc.name)) continue
      const target =
        acc.section === 'trading_income' || acc.section === 'other_income'
          ? mapped.revenue
          : acc.section === 'cost_of_sales'
            ? mapped.cogs
            : acc.section === 'operating_expenses'
              ? mapped.opex
              : null
      if (!target) continue
      for (let i = 0; i < acc.values.length; i++) {
        target[i] += acc.values[i] ?? 0
      }
    }

    const net = mapped.revenue.map((v, i) => v - mapped.cogs[i] - mapped.opex[i])
    return { ...mapped, net }
  }, [pl, mappedAccountSet])

  const unmappedTotals = useMemo(() => {
    if (!legacyTotals || !mappedTotals) return null
    const subtract = (a: number[], b: number[]) => a.map((v, i) => (v ?? 0) - (b?.[i] ?? 0))
    return {
      revenue: subtract(legacyTotals.revenue, mappedTotals.revenue),
      cogs: subtract(legacyTotals.cogs, mappedTotals.cogs),
      opex: subtract(legacyTotals.opex, mappedTotals.opex),
      net: subtract(legacyTotals.net, mappedTotals.net),
    }
  }, [legacyTotals, mappedTotals])

  const totalActivity = useMemo(() => {
    if (!pl) return 0
    return pl.accounts.reduce((sum, acc) => sum + acc.values.reduce((s, v) => s + Math.abs(v ?? 0), 0), 0)
  }, [pl])

  const coveragePct = (lineId: string) => {
    if (!computed || !totalActivity) return 0
    const vals = computed.byLineId[lineId] ?? []
    const activity = vals.reduce((s, v) => s + Math.abs(v ?? 0), 0)
    return totalActivity ? activity / totalActivity : 0
  }

  const monthlyFooter = useMemo(() => {
    if (!pl || !totals) return [] as { label: string; values: number[] }[]
    const grossProfit = totals.revenue.map((r, i) => r - totals.cogs[i])
    const ebit = totals.revenue.map((r, i) => r - totals.cogs[i] - totals.opex[i])
    const ebitda = ebit.map((e, i) => e + (hasAnyMapping ? (depAmort[i] ?? 0) : 0))
    return [
      { label: 'Total revenue', values: totals.revenue },
      { label: 'Total COGS', values: totals.cogs },
      { label: 'Gross profit', values: grossProfit },
      { label: 'Total OpEx', values: totals.opex },
      { label: 'EBITDA', values: ebitda },
      { label: 'EBIT', values: ebit },
      { label: 'Net profit', values: totals.net },
    ]
  }, [pl, totals, depAmort, hasAnyMapping])

  const reconciliationRows = useMemo(() => {
    if (!totals || !legacyTotals) return [] as { label: string; legacy: number; management: number; delta: number }[]
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (b ?? 0), 0)
    const rows = [
      { label: 'Revenue', legacy: sum(legacyTotals.revenue), management: sum(totals.revenue) },
      { label: 'COGS', legacy: sum(legacyTotals.cogs), management: sum(totals.cogs) },
      { label: 'OpEx', legacy: sum(legacyTotals.opex), management: sum(totals.opex) },
      { label: 'Net', legacy: sum(legacyTotals.net), management: sum(totals.net) },
    ]
    return rows.map(r => ({ ...r, delta: r.management - r.legacy }))
  }, [totals, legacyTotals])

  const rootFiltered = useMemo(() => {
    if (!q) return template.root
    const needle = q.toLowerCase()
    const filter = (node: DreamGroup | DreamLine): DreamGroup | DreamLine | null => {
      if (node.kind === 'line') return node.label.toLowerCase().includes(needle) ? node : null
      const kids = node.children.map(filter).filter(Boolean) as (DreamGroup | DreamLine)[]
      if (node.label.toLowerCase().includes(needle)) return { ...node, children: node.children } // keep as-is
      if (kids.length) return { ...node, children: kids }
      return null
    }
    return (filter(template.root) as DreamGroup) ?? template.root
  }, [template, q])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!pl) {
    return (
      <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">P&amp;L (Management)</div>
            <div className="text-sm text-slate-200">
              Upload the Profit &amp; Loss export to unlock the management view and drill-down.
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&amp;L</Button>
            <Button variant="ghost" onClick={() => setView('overview')}>Go to overview</Button>
          </div>
        </div>
      </Card>
    )
  }

  const getVals = (id: string) => computed?.byLineId[id] ?? Array(pl.months.length).fill(0)

  return (
    <Card className="p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">P&amp;L (Management)</div>
          <div className="text-sm text-slate-300">
            Same underlying Xero data, re-expressed into your management layout. Click a line to drill down.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Chip tone={unmappedAccountNames.length ? 'bad' : 'good'}>
            {unmappedAccountNames.length ? `${unmappedAccountNames.length} unmapped` : 'All accounts mapped'}
          </Chip>
          <Button variant="ghost" onClick={() => setView('mapping')}>
            <Settings2 className="h-4 w-4" /> Map accounts
          </Button>
        </div>
      </div>

      {totals && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Revenue</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.revenue.reduce((a, b) => a + b, 0))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo COGS</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.cogs.reduce((a, b) => a + b, 0))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo OpEx</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.opex.reduce((a, b) => a + b, 0))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Net</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.net.reduce((a, b) => a + b, 0))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="w-80">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search management lines…" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Unmapped lines show as “Unmapped” until you map accounts.</span>
          <Button
            variant="ghost"
            className={`px-3 py-1 text-xs ${showReconciliation ? 'border-indigo-400/40 bg-indigo-500/10' : ''}`}
            onClick={() => setShowReconciliation(v => !v)}
          >
            <RefreshCcw className="h-3.5 w-3.5" /> {showReconciliation ? 'Hide' : 'Show'} reconciliation
          </Button>
        </div>
      </div>

      {showReconciliation && reconciliationRows.length > 0 && (
        <div className="mt-3 overflow-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Metric</th>
                <th className="text-right px-3 py-2 font-semibold">Legacy</th>
                <th className="text-right px-3 py-2 font-semibold">Management</th>
                <th className="text-right px-3 py-2 font-semibold">Delta</th>
              </tr>
            </thead>
            <tbody>
              {reconciliationRows.map(row => (
                <tr key={row.label} className="border-t border-white/10">
                  <td className="px-3 py-2 font-semibold text-slate-100">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.legacy)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.management)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${row.delta === 0 ? 'text-slate-200' : row.delta > 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                    {formatCurrency(row.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs text-slate-400">Delta = Dream totals − Legacy totals. Map accounts to close the gap.</div>
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Dream category</th>
              {pl.monthLabels.map(m => (
                <th key={m} className="text-right px-3 py-2 font-semibold whitespace-nowrap">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rootFiltered.children.map(child => (
              <Row
                key={child.id}
                node={child}
                depth={0}
                months={pl.months.length}
                getVals={getVals}
                onSelect={id => setSelectedLineId(id)}
                expanded={expanded}
                toggle={toggle}
                coveragePct={coveragePct}
              />
            ))}
          </tbody>
          <tfoot className="bg-white/5 sticky bottom-0 z-10 border-t border-white/10">
            {monthlyFooter.map(row => (
              <tr key={row.label} className="border-t border-white/10">
                <td className="px-3 py-2 font-semibold text-slate-100">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right font-semibold tabular-nums text-slate-100">
                    {formatCurrency(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Tip: click any line item to see mapped accounts and GL transactions. Use <span className="kbd">Map accounts</span> to edit mappings.
      </div>
    </Card>
  )
}

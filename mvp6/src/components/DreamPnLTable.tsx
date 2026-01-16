import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ChevronRight, RefreshCcw, Settings2, MoveHorizontal } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { computeDepAmort, computeDream, computeDreamTotals, computeXeroTotals } from '../lib/dream/compute'
import { DreamGroup, DreamLine } from '../lib/types'
import { Button, Card, Chip, Input } from './ui'
import { formatCurrency, formatPercent } from '../lib/format'
import { buildEffectiveLedger, buildEffectivePl } from '../lib/ledger'
import { createCopyMenuItems, buildRowCopyItems, useContextMenu } from './ContextMenu'
import { CopyAffordance } from './CopyAffordance'
import { PageHeader } from './PageHeader'
import { useDragScroll } from '../lib/useDragScroll'

function Row({
  node,
  depth,
  months,
  getVals,
  onSelect,
  expanded,
  toggle,
  coveragePct,
  onOpenMenu,
  onCopyToast,
  rowPadding,
  pinnedFirstColumn,
  selectedRows,
  onToggleSelect,
  showZeros,
  prefersReducedMotion,
}: {
  node: DreamGroup | DreamLine
  depth: number
  months: number
  getVals: (id: string) => number[]
  onSelect: (id: string) => void
  expanded: Set<string>
  toggle: (id: string) => void
  coveragePct: (id: string) => number
  onOpenMenu: ReturnType<typeof useContextMenu>['openMenu']
  onCopyToast: () => void
  rowPadding: string
  pinnedFirstColumn: boolean
  selectedRows: string[]
  onToggleSelect: (id: string) => void
  showZeros: boolean
  prefersReducedMotion: boolean | null
}) {
  const isGroup = node.kind === 'group'
  const pad = 12 + depth * 14
  const vals = isGroup ? null : getVals(node.id)
  const coverage = isGroup || !vals ? null : coveragePct(node.id)
  const allZeros = !isGroup && (vals ?? []).every(v => (v ?? 0) === 0)
  const rowTone = isGroup ? 'bg-slate-900/60' : 'odd:bg-slate-900/30 even:bg-slate-900/10'

  if (!isGroup && !showZeros && allZeros) return null

  return (
    <>
      <motion.tr
        className={`border-t border-white/10 hover:bg-white/10 cursor-pointer focus-within:bg-white/10 ${rowTone} ${
          selectedRows.includes(node.id) ? 'bg-indigo-500/10' : ''
        }`}
        onClick={() => (isGroup ? toggle(node.id) : onSelect(node.id))}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            isGroup ? toggle(node.id) : onSelect(node.id)
          }
        }}
        onContextMenu={(event) => {
          if (isGroup) return
          const rowValues = getVals(node.id).map(v => v.toString())
          onOpenMenu({
            event,
            items: buildRowCopyItems({
              label: node.label,
              row: [node.label, ...rowValues],
              onDrill: () => onSelect(node.id),
              onCopied: onCopyToast,
            }),
            title: 'Dream line',
          })
        }}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
      >
        <td
          className={`px-3 ${rowPadding} ${pinnedFirstColumn ? 'sticky left-0 z-10 bg-slate-950' : ''}`}
          style={{ paddingLeft: pad }}
        >
          <div className="flex items-center gap-2">
            {!isGroup && (
              <input
                type="checkbox"
                checked={selectedRows.includes(node.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => onToggleSelect(node.id)}
              />
            )}
            {isGroup ? (
              expanded.has(node.id) ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />
            ) : (
              <span className="h-4 w-4" />
            )}
            <div className={isGroup ? 'font-semibold text-slate-100' : 'text-slate-100'}>{node.label}</div>
            {!isGroup && (
              <div className="ml-auto flex items-center gap-2">
                <Chip className="whitespace-nowrap">
                  {node.mappedAccounts?.length ?? 0} mapped and {coverage !== null ? formatPercent(coverage, { maximumFractionDigits: 1 }) : '0%'} coverage
                </Chip>
                {(node.mappedAccounts?.length ?? 0) === 0 && <Chip className="whitespace-nowrap" tone="bad">Unmapped</Chip>}
              </div>
            )}
          </div>
        </td>
        {Array.from({ length: months }).map((_, i) => (
          <td
            key={i}
            className={`px-3 ${rowPadding} text-right tabular-nums group`}
            onContextMenu={(event) => {
              if (isGroup) return
              const value = vals?.[i] ?? 0
              onOpenMenu({
                event,
                items: createCopyMenuItems({
                  label: node.label,
                  value: value.toString(),
                  formatted: formatCurrency(value),
                  onCopied: onCopyToast,
                }),
                title: node.label,
              })
            }}
          >
            <div className="flex items-center justify-end gap-2">
              {isGroup ? (
                <span className="text-slate-500">-</span>
              ) : (vals?.[i] ?? 0) === 0 ? (
                <span className="text-slate-500">0</span>
              ) : (
                formatCurrency(vals?.[i] ?? 0)
              )}
              {!isGroup && <CopyAffordance label={node.label} value={(vals?.[i] ?? 0).toString()} formatted={formatCurrency(vals?.[i] ?? 0)} />}
            </div>
          </td>
        ))}
      </motion.tr>

      <AnimatePresence initial={false}>
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
              onOpenMenu={onOpenMenu}
              onCopyToast={onCopyToast}
              rowPadding={rowPadding}
              pinnedFirstColumn={pinnedFirstColumn}
              selectedRows={selectedRows}
              onToggleSelect={onToggleSelect}
              showZeros={showZeros}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
      </AnimatePresence>
    </>
  )
}

export function DreamPnLTable() {
  const pl = useAppStore(s => s.pl)
  const template = useAppStore(s => s.template)
  const gl = useAppStore(s => s.gl)
  const txnOverrides = useAppStore(s => s.txnOverrides)
  const doctorRules = useAppStore(s => s.doctorRules)
  const setSelectedLineId = useAppStore(s => s.setSelectedLineId)
  const setView = useAppStore(s => s.setView)
  const [q, setQ] = useState('')
  const [showZeros, setShowZeros] = useState(true)
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable')
  const [pinnedFirstColumn, setPinnedFirstColumn] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [datePreset, setDatePreset] = useState<'ttm' | 'last6' | 'last3' | 'last1' | 'custom' | 'all'>('ttm')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [firstColumnWidth, setFirstColumnWidth] = useState(260)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['rev', 'cogs', 'opex']))
  const [sectionFilters, setSectionFilters] = useState<{ rev: boolean; cogs: boolean; opex: boolean }>({
    rev: true,
    cogs: true,
    opex: true,
  })
  const [showReconciliation, setShowReconciliation] = useState(false)
  const { openMenu, pushToast } = useContextMenu()
  const prefersReducedMotion = useReducedMotion()
  const { ref: tableRef, dragging, handlers: dragHandlers } = useDragScroll<HTMLDivElement>()
  const buildCopyItems = (label: string, value: string, formatted?: string) =>
    createCopyMenuItems({ label, value, formatted, onCopied: () => pushToast('Copied') })

  const effectiveLedger = useMemo(
    () => (gl ? buildEffectiveLedger(gl.txns, txnOverrides, doctorRules) : null),
    [gl, txnOverrides, doctorRules]
  )
  const effectivePl = useMemo(
    () =>
      pl && effectiveLedger
        ? buildEffectivePl(pl, effectiveLedger, true, gl?.txns.map(row => row.account))
        : pl,
    [pl, effectiveLedger, gl]
  )
  const operatingPl = useMemo(
    () =>
      pl && effectiveLedger
        ? buildEffectivePl(pl, effectiveLedger, false, gl?.txns.map(row => row.account))
        : pl,
    [pl, effectiveLedger, gl]
  )

  const monthRange = useMemo(() => {
    if (!operatingPl) return { start: 0, end: -1 }
    const count = operatingPl.monthLabels.length
    let start = 0
    let end = count - 1
    if (datePreset === 'ttm') start = Math.max(0, count - 12)
    if (datePreset === 'last1') start = Math.max(0, count - 1)
    if (datePreset === 'last6') start = Math.max(0, count - 6)
    if (datePreset === 'last3') start = Math.max(0, count - 3)
    if (datePreset === 'custom') {
      const startIdx = customStart ? operatingPl.monthLabels.indexOf(customStart) : 0
      const endIdx = customEnd ? operatingPl.monthLabels.indexOf(customEnd) : count - 1
      start = startIdx >= 0 ? startIdx : 0
      end = endIdx >= 0 ? endIdx : count - 1
      if (start > end) [start, end] = [end, start]
    }
    return { start, end }
  }, [operatingPl, datePreset, customStart, customEnd])

  const visibleMonthLabels = useMemo(() => {
    if (!operatingPl || monthRange.end < 0) return []
    return operatingPl.monthLabels.slice(monthRange.start, monthRange.end + 1)
  }, [operatingPl, monthRange])

  const computed = useMemo(() => (operatingPl ? computeDream(operatingPl, template) : null), [operatingPl, template])
  const totals = useMemo(() => (operatingPl && computed ? computeDreamTotals(operatingPl, template, computed) : null), [operatingPl, template, computed])
  const legacyTotals = useMemo(() => (operatingPl ? computeXeroTotals(operatingPl) : null), [operatingPl])
  const netTotals = useMemo(() => (effectivePl ? computeXeroTotals(effectivePl) : null), [effectivePl])

  const depAmort = useMemo(() => (operatingPl ? computeDepAmort(operatingPl) : []), [operatingPl])

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
    if (!operatingPl) return []
    return operatingPl.accounts.map(a => a.name).filter(name => !mappedAccountSet.has(name))
  }, [operatingPl, mappedAccountSet])

  const mappedTotals = useMemo(() => {
    if (!operatingPl) return null
    const blank = () => Array(operatingPl.months.length).fill(0)
    const mapped = { revenue: blank(), cogs: blank(), opex: blank() }

    for (const acc of operatingPl.accounts) {
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
  }, [operatingPl, mappedAccountSet])

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
    if (!operatingPl) return 0
    return operatingPl.accounts.reduce((sum, acc) => sum + acc.values.reduce((s, v) => s + Math.abs(v ?? 0), 0), 0)
  }, [operatingPl])

  const coveragePct = (lineId: string) => {
    if (!computed || !totalActivity) return 0
    const vals = computed.byLineId[lineId] ?? []
    const activity = vals.reduce((s, v) => s + Math.abs(v ?? 0), 0)
    return totalActivity ? activity / totalActivity : 0
  }

  const monthlyFooter = useMemo(() => {
    if (!operatingPl || !totals || !netTotals) return [] as { label: string; values: number[] }[]
    const grossProfit = totals.revenue.map((r, i) => r - totals.cogs[i])
    const ebit = totals.revenue.map((r, i) => r - totals.cogs[i] - totals.opex[i])
    const ebitda = ebit.map((e, i) => e + (hasAnyMapping ? (depAmort[i] ?? 0) : 0))
    const slice = (values: number[]) => values.slice(monthRange.start, monthRange.end + 1)
    return [
      { label: 'Total revenue', values: slice(totals.revenue) },
      { label: 'Total COGS', values: slice(totals.cogs) },
      { label: 'Gross profit', values: slice(grossProfit) },
      { label: 'Total OpEx', values: slice(totals.opex) },
      { label: 'EBITDA', values: slice(ebitda) },
      { label: 'EBIT', values: slice(ebit) },
      { label: 'Net profit', values: slice(netTotals.net) },
    ]
  }, [operatingPl, totals, netTotals, depAmort, hasAnyMapping, monthRange])

  const reconciliationRows = useMemo(() => {
    if (!totals || !legacyTotals || !netTotals) return [] as { label: string; legacy: number; management: number; delta: number }[]
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (b ?? 0), 0)
    const rows = [
      { label: 'Revenue', legacy: sum(legacyTotals.revenue), management: sum(totals.revenue) },
      { label: 'COGS', legacy: sum(legacyTotals.cogs), management: sum(totals.cogs) },
      { label: 'OpEx', legacy: sum(legacyTotals.opex), management: sum(totals.opex) },
      { label: 'Net', legacy: sum(legacyTotals.net), management: sum(netTotals.net) },
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

  const sliceVals = (values: number[]) => values.slice(monthRange.start, monthRange.end + 1)
  const getVals = (id: string) => sliceVals(computed?.byLineId[id] ?? Array(operatingPl?.months.length ?? 0).fill(0))

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5'

  const toggleSelectRow = (id: string) => {
    setSelectedRows(prev => (prev.includes(id) ? prev.filter(row => row !== id) : [...prev, id]))
  }

  const collectRows = (node: DreamGroup | DreamLine, rows: { label: string; values: number[]; id: string }[]) => {
    if (node.kind === 'line') {
      const values = getVals(node.id)
      if (!showZeros && values.every(v => (v ?? 0) === 0)) return
      rows.push({ label: node.label, values, id: node.id })
      return
    }
    node.children.forEach(child => collectRows(child, rows))
  }

  const visibleRows = useMemo(() => {
    const rows: { label: string; values: number[]; id: string }[] = []
    rootFiltered.children
      .filter(child => child.kind !== 'group' || sectionFilters[child.id as 'rev' | 'cogs' | 'opex'])
      .forEach(child => collectRows(child, rows))
    return rows
  }, [rootFiltered, sectionFilters, showZeros, getVals])

  const buildCsv = (rows: { label: string; values: number[] }[]) => {
    const header = ['Line item', ...visibleMonthLabels]
    const body = rows.map(row => [row.label, ...row.values.map(v => (v ?? 0).toString())])
    return [header, ...body].map(line => line.join(',')).join('\n')
  }

  const copyCsv = async (rows: { label: string; values: number[] }[]) => {
    if (!rows.length) {
      pushToast('No rows to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(buildCsv(rows))
      pushToast('Copied')
    } catch {
      pushToast('Copy failed')
    }
  }

  if (!effectivePl) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="P&amp;L (Management)"
          subtitle="Upload the Profit & Loss export to unlock the management view and drill-down."
          actions={
            <>
              <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&amp;L</Button>
              <Button variant="ghost" onClick={() => setView('overview')}>Go to overview</Button>
            </>
          }
        />
        <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
          <div className="text-sm text-slate-200">Upload a P&amp;L to unlock the management table.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="P&amp;L (Management)"
        subtitle="Same underlying Xero data, re-expressed into your management layout. Click a line to drill down."
        actions={
          <>
            <Chip tone={unmappedAccountNames.length ? 'bad' : 'good'}>
              {unmappedAccountNames.length ? `${unmappedAccountNames.length} unmapped` : 'All accounts mapped'}
            </Chip>
            <Button variant="ghost" onClick={() => setView('mapping')}>
              <Settings2 className="h-4 w-4" /> Map accounts
            </Button>
          </>
        }
      />

      <Card className="p-6 overflow-hidden">

      {totals && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-3"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('12-mo Revenue', totals.revenue.reduce((a, b) => a + b, 0).toString(), formatCurrency(totals.revenue.reduce((a, b) => a + b, 0))),
                title: '12-mo Revenue',
              })
            }
          >
            <div className="text-xs text-slate-300">12-mo Revenue</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.revenue.reduce((a, b) => a + b, 0))}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="12-mo Revenue" value={totals.revenue.reduce((a, b) => a + b, 0).toString()} formatted={formatCurrency(totals.revenue.reduce((a, b) => a + b, 0))} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-3"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('12-mo COGS', totals.cogs.reduce((a, b) => a + b, 0).toString(), formatCurrency(totals.cogs.reduce((a, b) => a + b, 0))),
                title: '12-mo COGS',
              })
            }
          >
            <div className="text-xs text-slate-300">12-mo COGS</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.cogs.reduce((a, b) => a + b, 0))}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="12-mo COGS" value={totals.cogs.reduce((a, b) => a + b, 0).toString()} formatted={formatCurrency(totals.cogs.reduce((a, b) => a + b, 0))} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-3"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('12-mo OpEx', totals.opex.reduce((a, b) => a + b, 0).toString(), formatCurrency(totals.opex.reduce((a, b) => a + b, 0))),
                title: '12-mo OpEx',
              })
            }
          >
            <div className="text-xs text-slate-300">12-mo OpEx</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.opex.reduce((a, b) => a + b, 0))}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="12-mo OpEx" value={totals.opex.reduce((a, b) => a + b, 0).toString()} formatted={formatCurrency(totals.opex.reduce((a, b) => a + b, 0))} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-3"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('12-mo Net', totals.net.reduce((a, b) => a + b, 0).toString(), formatCurrency(totals.net.reduce((a, b) => a + b, 0))),
                title: '12-mo Net',
              })
            }
          >
            <div className="text-xs text-slate-300">12-mo Net</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(totals.net.reduce((a, b) => a + b, 0))}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="12-mo Net" value={totals.net.reduce((a, b) => a + b, 0).toString()} formatted={formatCurrency(totals.net.reduce((a, b) => a + b, 0))} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search management lines..." />
          <Button variant="ghost" size="sm" onClick={() => setFilterOpen(true)}>
            Filters
          </Button>
          <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1 py-1 text-[11px] text-slate-300">
            {[
              { id: 'last1', label: '1M' },
              { id: 'last3', label: '3M' },
              { id: 'last6', label: '6M' },
              { id: 'ttm', label: '12M' },
              { id: 'all', label: 'All' },
              { id: 'custom', label: 'Range' },
            ].map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDatePreset(option.id as typeof datePreset)}
                className={`rounded-full px-3 py-1 transition ${
                  datePreset === option.id ? 'bg-indigo-500/20 text-slate-100' : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <select
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
              >
                <option value="">Start</option>
                {operatingPl?.monthLabels.map(label => (
                  <option key={`start-${label}`} value={label}>{label}</option>
                ))}
              </select>
              <select
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
              >
                <option value="">End</option>
                {operatingPl?.monthLabels.map(label => (
                  <option key={`end-${label}`} value={label}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>
            Collapse all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set(['rev', 'cogs', 'opex']))}>
            Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDensity(prev => (prev === 'compact' ? 'comfortable' : 'compact'))}>
            Density: {density === 'compact' ? 'Compact' : 'Comfortable'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPinnedFirstColumn(prev => !prev)}>
            {pinnedFirstColumn ? 'Unpin first column' : 'Pin first column'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => copyCsv(visibleRows.map(row => ({ label: row.label, values: row.values })))}>
            Copy visible (CSV)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyCsv(visibleRows.filter(row => selectedRows.includes(row.id)).map(row => ({ label: row.label, values: row.values })))}
          >
            Copy selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={showReconciliation ? 'border-indigo-400/40 bg-indigo-500/10' : ''}
            onClick={() => setShowReconciliation(v => !v)}
          >
            <RefreshCcw className="h-3.5 w-3.5" /> {showReconciliation ? 'Hide' : 'Show'} reconciliation
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {filterOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFilterOpen(false)}
          >
            <motion.div
              className="h-full w-full max-w-md bg-slate-950 border-l border-white/10 p-5"
              initial={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-100">Table filters</div>
                <Button variant="ghost" size="sm" onClick={() => setFilterOpen(false)}>Close</Button>
              </div>

              <div className="mt-4 space-y-4 text-xs text-slate-300">
                <div>
                  <div className="font-semibold text-slate-100">Date range</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['last1', 'ttm', 'last6', 'last3', 'custom', 'all'] as const).map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDatePreset(preset)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          datePreset === preset ? 'border-indigo-400/40 bg-indigo-500/15 text-slate-100' : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        {preset === 'last1'
                          ? 'Last 1'
                          : preset === 'ttm'
                            ? 'TTM'
                            : preset === 'last6'
                              ? 'Last 6'
                              : preset === 'last3'
                                ? 'Last 3'
                                : preset === 'custom'
                                  ? 'Custom'
                                  : 'All'}
                      </button>
                    ))}
                  </div>
                  {datePreset === 'custom' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="">Start</option>
                        {operatingPl?.monthLabels.map(label => (
                          <option key={`start-${label}`} value={label}>{label}</option>
                        ))}
                      </select>
                      <select
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="">End</option>
                        {operatingPl?.monthLabels.map(label => (
                          <option key={`end-${label}`} value={label}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">Show zero rows</div>
                    <div className="text-[11px] text-slate-400">Hide lines with no activity.</div>
                  </div>
                  <input type="checkbox" checked={showZeros} onChange={() => setShowZeros(v => !v)} />
                </div>

                <div>
                  <div className="font-semibold text-slate-100">Categories</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([
                      { id: 'rev', label: 'Revenue' },
                      { id: 'cogs', label: 'COGS' },
                      { id: 'opex', label: 'OpEx' },
                    ] as const).map(section => (
                      <label key={section.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sectionFilters[section.id]}
                          onChange={() =>
                            setSectionFilters(prev => ({
                              ...prev,
                              [section.id]: !prev[section.id],
                            }))
                          }
                        />
                        <span>{section.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-100">First column width</div>
                  <input
                    type="range"
                    min={200}
                    max={420}
                    value={firstColumnWidth}
                    onChange={(e) => setFirstColumnWidth(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <div className="px-3 py-2 text-xs text-slate-400">Delta = Dream totals - Legacy totals. Map accounts to close the gap.</div>
        </div>
      )}

      <div
        ref={tableRef}
        {...dragHandlers}
        className={`group relative mt-4 overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      >
        <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200 opacity-0 transition group-hover:opacity-100">
          <span className="inline-flex items-center gap-1">
            <MoveHorizontal className="h-3.5 w-3.5" /> Drag to pan
          </span>
        </div>
        <table className="min-w-full text-sm">
          <colgroup>
            <col style={{ width: firstColumnWidth }} />
          </colgroup>
          <thead className="bg-slate-900/80 sticky top-0 z-20 backdrop-blur">
            <tr>
              <th
                className={`text-left px-3 ${rowPadding} font-semibold ${pinnedFirstColumn ? 'sticky left-0 z-30 bg-slate-950' : ''}`}
              >
                Dream category
              </th>
              {visibleMonthLabels.map(m => (
                <th key={m} className={`text-right px-3 ${rowPadding} font-semibold whitespace-nowrap`}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rootFiltered.children
              .filter(child => child.kind !== 'group' || sectionFilters[child.id as 'rev' | 'cogs' | 'opex'])
              .map(child => (
                <Row
                  key={child.id}
                  node={child}
                  depth={0}
                  months={visibleMonthLabels.length}
                  getVals={getVals}
                  onSelect={id => setSelectedLineId(id)}
                  expanded={expanded}
                  toggle={toggle}
                  coveragePct={coveragePct}
                  onOpenMenu={openMenu}
                  onCopyToast={() => pushToast('Copied')}
                  rowPadding={rowPadding}
                  pinnedFirstColumn={pinnedFirstColumn}
                  selectedRows={selectedRows}
                  onToggleSelect={toggleSelectRow}
                  showZeros={showZeros}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
          </tbody>
          <tfoot className="bg-indigo-500/10 sticky bottom-0 z-10 border-t border-indigo-400/20">
            {monthlyFooter.map(row => (
              <tr key={row.label} className="border-t border-indigo-400/20">
                <td
                  className={`px-3 ${rowPadding} font-semibold text-slate-100 ${pinnedFirstColumn ? 'sticky left-0 z-10 bg-slate-950' : ''}`}
                >
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 ${rowPadding} text-right font-semibold tabular-nums text-slate-100 group`}
                    onContextMenu={(event) =>
                      openMenu({
                        event,
                        items: buildCopyItems(row.label, (v ?? 0).toString(), formatCurrency(v ?? 0)),
                        title: row.label,
                      })
                    }
                  >
                    <div className="flex items-center justify-end gap-2">
                      {formatCurrency(v)}
                      <CopyAffordance label={row.label} value={(v ?? 0).toString()} formatted={formatCurrency(v ?? 0)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Tip: drag to pan horizontally, then click any line item to see mapped accounts and GL transactions. Use <span className="kbd">Map accounts</span> to edit mappings.
      </div>
    </Card>
    </div>
  )
}

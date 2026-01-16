import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ChevronRight, MoveHorizontal } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Card, Chip, Input, Button } from './ui'
import { XeroPLSection } from '../lib/types'
import { computeDepAmort, computeXeroTotals } from '../lib/dream/compute'
import { formatCurrency } from '../lib/format'
import { DataHealthSummary } from './DataHealthSummary'
import { buildEffectiveLedger, buildEffectivePl } from '../lib/ledger'
import { useContextMenu, createCopyMenuItems, buildRowCopyItems } from './ContextMenu'
import { CopyAffordance } from './CopyAffordance'
import { PageHeader } from './PageHeader'
import { useDragScroll } from '../lib/useDragScroll'

const sectionLabels: Record<XeroPLSection, string> = {
  trading_income: 'Trading Income',
  cost_of_sales: 'Cost of Sales',
  other_income: 'Other Income',
  operating_expenses: 'Operating Expenses',
  unknown: 'Other / Unclassified',
}

export function LegacyPnLTable() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const txnOverrides = useAppStore(s => s.txnOverrides)
  const doctorRules = useAppStore(s => s.doctorRules)
  const setView = useAppStore(s => s.setView)
  const setSelectedLineId = useAppStore(s => s.setSelectedLineId)
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
  const { ref: tableRef, dragging, handlers: dragHandlers } = useDragScroll<HTMLDivElement>()
  const [expandedSections, setExpandedSections] = useState<Record<XeroPLSection, boolean>>({
    trading_income: true,
    cost_of_sales: true,
    other_income: true,
    operating_expenses: true,
    unknown: true,
  })
  const [sectionFilters, setSectionFilters] = useState<Record<XeroPLSection, boolean>>({
    trading_income: true,
    cost_of_sales: true,
    other_income: true,
    operating_expenses: true,
    unknown: true,
  })

  const { openMenu, pushToast } = useContextMenu()
  const prefersReducedMotion = useReducedMotion()
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
    if (!effectivePl) return { start: 0, end: -1 }
    const count = effectivePl.monthLabels.length
    let start = 0
    let end = count - 1
    if (datePreset === 'ttm') start = Math.max(0, count - 12)
    if (datePreset === 'last1') start = Math.max(0, count - 1)
    if (datePreset === 'last6') start = Math.max(0, count - 6)
    if (datePreset === 'last3') start = Math.max(0, count - 3)
    if (datePreset === 'custom') {
      const startIdx = customStart ? effectivePl.monthLabels.indexOf(customStart) : 0
      const endIdx = customEnd ? effectivePl.monthLabels.indexOf(customEnd) : count - 1
      start = startIdx >= 0 ? startIdx : 0
      end = endIdx >= 0 ? endIdx : count - 1
      if (start > end) [start, end] = [end, start]
    }
    return { start, end }
  }, [effectivePl, datePreset, customStart, customEnd])

  const visibleMonthLabels = useMemo(() => {
    if (!effectivePl || monthRange.end < 0) return []
    return effectivePl.monthLabels.slice(monthRange.start, monthRange.end + 1)
  }, [effectivePl, monthRange])

  const sections = useMemo(() => {
    if (!effectivePl) return []
    const match = (name: string) => !q || name.toLowerCase().includes(q.toLowerCase())
    const by: Record<string, { name: string; section: XeroPLSection; values: number[]; total: number }[]> = {}
    for (const a of effectivePl.accounts) {
      if (!match(a.name)) continue
      if (!sectionFilters[a.section]) continue
      const values = a.values.slice(monthRange.start, monthRange.end + 1)
      if (!showZeros && values.every(v => (v ?? 0) === 0)) continue
      by[a.section] = by[a.section] ?? []
      by[a.section].push({ name: a.name, section: a.section, values, total: values.reduce((sum, v) => sum + (v ?? 0), 0) })
    }
    return Object.entries(by).map(([section, accounts]) => ({
      section: section as XeroPLSection,
      accounts,
    }))
  }, [effectivePl, q, monthRange, showZeros, sectionFilters])

  const totals = useMemo(() => (operatingPl ? computeXeroTotals(operatingPl) : null), [operatingPl])
  const netTotals = useMemo(() => (effectivePl ? computeXeroTotals(effectivePl) : null), [effectivePl])
  const depAmort = useMemo(() => (operatingPl ? computeDepAmort(operatingPl) : null), [operatingPl])

  const footer = useMemo(() => {
    if (!totals || !netTotals) return null
    const n = totals.revenue.length
    const gross = Array(n).fill(0).map((_, i) => totals.revenue[i] - totals.cogs[i])
    const ebit = Array(n).fill(0).map((_, i) => totals.revenue[i] - totals.cogs[i] - totals.opex[i])
    const da = depAmort ?? Array(n).fill(0)
    const ebitda = Array(n).fill(0).map((_, i) => ebit[i] + (da[i] ?? 0))
    const slice = (values: number[]) => values.slice(monthRange.start, monthRange.end + 1)
    return {
      rows: [
        { label: 'Total Revenue', values: slice(totals.revenue) },
        { label: 'Total COGS', values: slice(totals.cogs) },
        { label: 'Gross Profit', values: slice(gross) },
        { label: 'Total OpEx', values: slice(totals.opex) },
        { label: 'EBITDA', values: slice(ebitda) },
        { label: 'EBIT', values: slice(ebit) },
        { label: 'Net Profit', values: slice(netTotals.net) },
      ],
    }
  }, [totals, netTotals, depAmort, monthRange])

  const toggleSection = (section: XeroPLSection) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleActivate = (id: string) => {
    setSelectedLineId(id)
  }

  const onRowKey = (e: React.KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleActivate(id)
    }
  }

  const rowPadding = density === 'compact' ? 'py-1.5' : 'py-2.5'

  const toggleSelectRow = (name: string) => {
    setSelectedRows(prev => (prev.includes(name) ? prev.filter(row => row !== name) : [...prev, name]))
  }

  const buildCsv = (rows: { name: string; values: number[] }[]) => {
    const header = ['Account', ...visibleMonthLabels]
    const body = rows.map(row => [row.name, ...row.values.map(v => v.toString())])
    return [header, ...body].map(line => line.join(',')).join('\n')
  }

  const copyCsv = async (rows: { name: string; values: number[] }[]) => {
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

  const visibleRows = sections.flatMap(section => section.accounts.map(acc => ({ name: acc.name, values: acc.values })))

  if (!effectivePl) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="P&L (Legacy)"
          subtitle="Upload the Profit & Loss export to mirror Xero rows and months."
          actions={
            <>
              <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&L</Button>
              <Button variant="secondary" onClick={() => setView('overview')}>Go to overview</Button>
            </>
          }
        />
        <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
          <div className="text-sm text-slate-200">Upload a P&amp;L to unlock the legacy table.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="P&L (Legacy)" subtitle="Rows mirror Xero accounts. Columns are months." />
      <Card className="p-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search accounts..." />
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
                  {effectivePl?.monthLabels.map(label => (
                    <option key={`start-${label}`} value={label}>{label}</option>
                  ))}
                </select>
                <select
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
                >
                  <option value="">End</option>
                  {effectivePl?.monthLabels.map(label => (
                    <option key={`end-${label}`} value={label}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <Button variant="ghost" size="sm" onClick={() => setExpandedSections({
              trading_income: false,
              cost_of_sales: false,
              other_income: false,
              operating_expenses: false,
              unknown: false,
            })}>
              Collapse all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpandedSections({
              trading_income: true,
              cost_of_sales: true,
              other_income: true,
              operating_expenses: true,
              unknown: true,
            })}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDensity(prev => (prev === 'compact' ? 'comfortable' : 'compact'))}>
              Density: {density === 'compact' ? 'Compact' : 'Comfortable'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPinnedFirstColumn(prev => !prev)}>
              {pinnedFirstColumn ? 'Unpin first column' : 'Pin first column'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => copyCsv(visibleRows)}>
              Copy visible (CSV)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => copyCsv(visibleRows.filter(row => selectedRows.includes(row.name)))}>
              Copy selected
            </Button>
          </div>
        </div>

      {totals && netTotals && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { label: '12-mo Revenue', value: totals.revenue.reduce((a, b) => a + b, 0) },
            { label: '12-mo COGS', value: totals.cogs.reduce((a, b) => a + b, 0) },
            { label: '12-mo OpEx', value: totals.opex.reduce((a, b) => a + b, 0) },
            { label: '12-mo Net', value: netTotals.net.reduce((a, b) => a + b, 0) },
          ].map(card => (
            <div
              key={card.label}
              className="group relative rounded-2xl border border-white/10 bg-white/5 p-3"
              onContextMenu={(event) =>
                openMenu({
                  event,
                  items: buildCopyItems(card.label, card.value.toString(), formatCurrency(card.value)),
                  title: card.label,
                })
              }
            >
              <div className="text-xs text-slate-300">{card.label}</div>
              <div className="text-lg font-semibold tabular-nums">{formatCurrency(card.value)}</div>
              <div className="absolute right-2 top-2">
                <CopyAffordance label={card.label} value={card.value.toString()} formatted={formatCurrency(card.value)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {effectivePl && <DataHealthSummary pl={effectivePl} className="mt-4" />}

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
                        {effectivePl?.monthLabels.map(label => (
                          <option key={`start-${label}`} value={label}>{label}</option>
                        ))}
                      </select>
                      <select
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="">End</option>
                        {effectivePl?.monthLabels.map(label => (
                          <option key={`end-${label}`} value={label}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-100">Show zero rows</div>
                    <div className="text-[11px] text-slate-400">Hide accounts with no activity.</div>
                  </div>
                  <input type="checkbox" checked={showZeros} onChange={() => setShowZeros(v => !v)} />
                </div>

                <div>
                  <div className="font-semibold text-slate-100">Categories</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Object.entries(sectionLabels).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sectionFilters[key as XeroPLSection]}
                          onChange={() =>
                            setSectionFilters(prev => ({
                              ...prev,
                              [key]: !prev[key as XeroPLSection],
                            }))
                          }
                        />
                        <span>{label}</span>
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
                Account
              </th>
              {visibleMonthLabels.map(m => (
                <th key={m} className={`text-right px-3 ${rowPadding} font-semibold whitespace-nowrap`}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <React.Fragment key={sec.section}>
                <tr className="bg-slate-900/70 border-t border-white/10">
                  <td
                    className={`px-3 ${rowPadding} font-semibold ${pinnedFirstColumn ? 'sticky left-0 z-20 bg-slate-950' : ''}`}
                    colSpan={1 + visibleMonthLabels.length}
                  >
                    <button
                      className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-lg px-1 py-1"
                      onClick={() => toggleSection(sec.section)}
                      aria-expanded={expandedSections[sec.section]}
                    >
                      {expandedSections[sec.section] ? (
                        <ChevronDown className="h-4 w-4 text-slate-300" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      )}
                      <span>{sectionLabels[sec.section]}</span>
                      <Chip className="ml-2">{sec.accounts.length}</Chip>
                    </button>
                  </td>
                </tr>
                <AnimatePresence initial={false}>
                  {expandedSections[sec.section] &&
                    sec.accounts.map(a => (
                      <motion.tr
                        key={`${sec.section}:${a.name}`}
                        className={`border-t border-white/10 hover:bg-white/10 cursor-pointer focus-within:bg-white/10 odd:bg-slate-900/30 even:bg-slate-900/10 ${
                          selectedRows.includes(a.name) ? 'bg-indigo-500/10' : ''
                        }`}
                        onClick={() => handleActivate(`__acc__:${a.name}`)}
                        tabIndex={0}
                        onKeyDown={e => onRowKey(e, `__acc__:${a.name}`)}
                        onContextMenu={(event) =>
                          openMenu({
                            event,
                            items: buildRowCopyItems({
                              label: a.name,
                              row: [a.name, ...a.values.map(v => (v ?? 0).toString())],
                              onDrill: () => handleActivate(`__acc__:${a.name}`),
                              onCopied: () => pushToast('Copied'),
                            }),
                            title: 'Account row',
                          })
                        }
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
                      >
                        <td
                          className={`px-3 ${rowPadding} text-slate-100 ${pinnedFirstColumn ? 'sticky left-0 z-10 bg-slate-950' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedRows.includes(a.name)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleSelectRow(a.name)}
                            />
                            <span>{a.name}</span>
                          </div>
                        </td>
                        {a.values.map((v, idx) => (
                          <td
                            key={idx}
                            className={`px-3 ${rowPadding} text-right tabular-nums group`}
                            onContextMenu={(event) =>
                              openMenu({
                                event,
                                items: buildCopyItems(a.name, (v ?? 0).toString(), formatCurrency(v ?? 0)),
                                title: a.name,
                              })
                            }
                          >
                            <div className="flex items-center justify-end gap-2">
                              <span>{v === 0 ? <span className="text-slate-500">0</span> : formatCurrency(v)}</span>
                              <CopyAffordance label={a.name} value={(v ?? 0).toString()} formatted={formatCurrency(v ?? 0)} />
                            </div>
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-indigo-500/10 sticky bottom-0 z-10 border-t border-indigo-400/20">
            {(footer?.rows ?? []).map(row => (
              <tr key={row.label} className="border-t border-indigo-400/20">
                <td
                  className={`px-3 ${rowPadding} font-semibold text-slate-100 whitespace-nowrap ${pinnedFirstColumn ? 'sticky left-0 z-10 bg-slate-950' : ''}`}
                >
                  {row.label}
                </td>
                {row.values.map((v, idx) => (
                  <td
                    key={idx}
                    className={`px-3 ${rowPadding} text-right tabular-nums font-semibold group`}
                    onContextMenu={(event) =>
                      openMenu({
                        event,
                        items: buildCopyItems(row.label, v.toString(), formatCurrency(v)),
                        title: row.label,
                      })
                    }
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span>{v === 0 ? <span className="text-slate-500">0</span> : formatCurrency(v)}</span>
                      <CopyAffordance label={row.label} value={v.toString()} formatted={formatCurrency(v)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <div className="mt-3 text-xs text-slate-400">Tip: drag to pan horizontally, and click an account to drill into the General Ledger (if loaded).</div>
    </Card>
    </div>
  )
}

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { Card, Chip, Input, Button } from './ui'
import { XeroPLSection } from '../lib/types'
import { computeDepAmort, computeXeroTotals } from '../lib/dream/compute'
import { formatCurrency } from '../lib/format'
import { DataHealthSummary } from './DataHealthSummary'

const sectionLabels: Record<XeroPLSection, string> = {
  trading_income: 'Trading Income',
  cost_of_sales: 'Cost of Sales',
  other_income: 'Other Income',
  operating_expenses: 'Operating Expenses',
  unknown: 'Other / Unclassified',
}

export function LegacyPnLTable() {
  const pl = useAppStore(s => s.pl)
  const setView = useAppStore(s => s.setView)
  const setSelectedLineId = useAppStore(s => s.setSelectedLineId)
  const [q, setQ] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<XeroPLSection, boolean>>({
    trading_income: true,
    cost_of_sales: true,
    other_income: true,
    operating_expenses: true,
    unknown: true,
  })

  const sections = useMemo(() => {
    if (!pl) return []
    const match = (name: string) => !q || name.toLowerCase().includes(q.toLowerCase())
    const by: Record<string, typeof pl.accounts> = {}
    for (const a of pl.accounts) {
      if (!match(a.name)) continue
      by[a.section] = by[a.section] ?? []
      by[a.section].push(a)
    }
    return Object.entries(by).map(([section, accounts]) => ({
      section: section as XeroPLSection,
      accounts,
    }))
  }, [pl, q])

  const totals = useMemo(() => (pl ? computeXeroTotals(pl) : null), [pl])
  const depAmort = useMemo(() => (pl ? computeDepAmort(pl) : null), [pl])

  const footer = useMemo(() => {
    if (!totals) return null
    const n = totals.revenue.length
    const gross = Array(n).fill(0).map((_, i) => totals.revenue[i] - totals.cogs[i])
    const ebit = Array(n).fill(0).map((_, i) => totals.revenue[i] - totals.cogs[i] - totals.opex[i])
    const da = depAmort ?? Array(n).fill(0)
    const ebitda = Array(n).fill(0).map((_, i) => ebit[i] + (da[i] ?? 0))
    return {
      rows: [
        { label: 'Total Revenue', values: totals.revenue },
        { label: 'Total COGS', values: totals.cogs },
        { label: 'Gross Profit', values: gross },
        { label: 'Total OpEx', values: totals.opex },
        { label: 'EBITDA', values: ebitda },
        { label: 'EBIT', values: ebit },
        { label: 'Net Profit', values: totals.net },
      ],
    }
  }, [totals, depAmort])

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

  if (!pl) {
    return (
      <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">P&amp;L (Legacy)</div>
            <div className="text-sm text-slate-200">Upload the Profit &amp; Loss export to mirror Xero rows and months.</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&amp;L</Button>
            <Button variant="ghost" onClick={() => setView('overview')}>Go to overview</Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">P&amp;L (Legacy)</div>
          <div className="text-sm text-slate-300">Rows mirror Xero accounts. Columns are months.</div>
        </div>
        <div className="w-72">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search accounts…" />
        </div>
      </div>

      {/* Top-level 12-month totals (same as Dream P&L) */}
      {totals && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Revenue</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totals.revenue.reduce((a, b) => a + b, 0))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo COGS</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totals.cogs.reduce((a, b) => a + b, 0))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo OpEx</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totals.opex.reduce((a, b) => a + b, 0))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Net</div>
            <div className="text-lg font-semibold tabular-nums">{formatCurrency(totals.net.reduce((a, b) => a + b, 0))}</div>
          </div>
        </div>
      )}

      {pl && <DataHealthSummary pl={pl} className="mt-4" />}

      <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Account</th>
              {pl.monthLabels.map(m => (
                <th key={m} className="text-right px-3 py-2 font-semibold whitespace-nowrap">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <React.Fragment key={sec.section}>
                <tr className="bg-white/5 border-t border-white/10">
                  <td className="px-3 py-2 font-semibold" colSpan={1 + pl.months.length}>
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
                {expandedSections[sec.section] &&
                  sec.accounts.map(a => (
                    <tr
                      key={`${sec.section}:${a.name}`}
                      className="border-t border-white/10 hover:bg-white/5 cursor-pointer focus-within:bg-white/5"
                      onClick={() => handleActivate(`__acc__:${a.name}`)}
                      tabIndex={0}
                      onKeyDown={e => onRowKey(e, `__acc__:${a.name}`)}
                    >
                      <td className="px-3 py-2 text-slate-100">{a.name}</td>
                      {a.values.map((v, idx) => (
                        <td key={idx} className="px-3 py-2 text-right tabular-nums">
                          {v === 0 ? <span className="text-slate-500">—</span> : formatCurrency(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-white/5 sticky bottom-0 z-10 border-t border-white/10">
            {(footer?.rows ?? []).map(row => (
              <tr key={row.label} className="border-t border-white/10">
                <td className="px-3 py-2 font-semibold text-slate-100 whitespace-nowrap">{row.label}</td>
                {row.values.map((v, idx) => (
                  <td key={idx} className="px-3 py-2 text-right tabular-nums font-semibold">
                    {v === 0 ? <span className="text-slate-500">—</span> : formatCurrency(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <div className="mt-3 text-xs text-slate-400">Tip: click an account to drill into the General Ledger (if loaded).</div>
    </Card>
  )
}

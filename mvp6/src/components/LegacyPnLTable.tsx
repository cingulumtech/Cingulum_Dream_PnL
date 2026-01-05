import React, { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Chip, Input } from './ui'
import { XeroPLSection } from '../lib/types'
import { computeDepAmort, computeXeroTotals } from '../lib/dream/compute'

const sectionLabels: Record<XeroPLSection, string> = {
  trading_income: 'Trading Income',
  cost_of_sales: 'Cost of Sales',
  other_income: 'Other Income',
  operating_expenses: 'Operating Expenses',
  unknown: 'Other / Unclassified',
}

export function LegacyPnLTable() {
  const pl = useAppStore(s => s.pl)
  const setSelectedLineId = useAppStore(s => s.setSelectedLineId)
  const [q, setQ] = useState('')

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

  if (!pl) {
    return (
      <Card className="p-5">
        <div className="text-sm text-slate-300">Upload a Profit &amp; Loss export to view the Xero-faithful table.</div>
      </Card>
    )
  }

  return (
    <Card className="p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Legacy P&amp;L (Xero-faithful)</div>
          <div className="text-sm text-slate-300">Rows mirror Xero accounts. Columns are months.</div>
        </div>
        <div className="w-72">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search accounts…" />
        </div>
      </div>

      {/* Top-level 12-month totals (same as Atlas P&L) */}
      {totals && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Revenue</div>
            <div className="text-lg font-semibold">{Math.round(totals.revenue.reduce((a, b) => a + b, 0)).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo COGS</div>
            <div className="text-lg font-semibold">{Math.round(totals.cogs.reduce((a, b) => a + b, 0)).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo OpEx</div>
            <div className="text-lg font-semibold">{Math.round(totals.opex.reduce((a, b) => a + b, 0)).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-slate-300">12-mo Net</div>
            <div className="text-lg font-semibold">{Math.round(totals.net.reduce((a, b) => a + b, 0)).toLocaleString()}</div>
          </div>
        </div>
      )}

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
                <tr className="bg-white/5">
                  <td className="px-3 py-2 font-semibold" colSpan={1 + pl.months.length}>
                    {sectionLabels[sec.section]} <Chip className="ml-2">{sec.accounts.length}</Chip>
                  </td>
                </tr>
                {sec.accounts.map(a => (
                  <tr
                    key={`${sec.section}:${a.name}`}
                    className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelectedLineId(`__acc__:${a.name}`)}
                  >
                    <td className="px-3 py-2 text-slate-100">{a.name}</td>
                    {a.values.map((v, idx) => (
                      <td key={idx} className="px-3 py-2 text-right tabular-nums">
                        {v === 0 ? <span className="text-slate-500">—</span> : v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                    {v === 0 ? <span className="text-slate-500">—</span> : Math.round(v).toLocaleString()}
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

import React, { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { useAppStore } from '../store/appStore'
import { computeXeroTotals, applyBundledScenario } from '../lib/dream/compute'
import { Card, Chip, Input, Label } from './ui'

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (b ?? 0), 0)
}

function mean(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0
}

function topN(accounts: any[], n: number) {
  return [...accounts]
    .map(a => ({ name: a.name, total: a.total, section: a.section }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .slice(0, n)
}

function buildTrendDataURL(months: string[], current: number[], scenario: number[] | null) {
  const w = 640
  const h = 260
  const pad = 28
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const values = [...current, ...(scenario ?? [])]
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const scaleY = (val: number) => {
    if (max === min) return h / 2
    return h - pad - ((val - min) / (max - min)) * (h - pad * 2)
  }
  const scaleX = (idx: number) => pad + (idx / Math.max(1, months.length - 1)) * (w - pad * 2)

  ctx.fillStyle = '#0b1222'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const y = pad + ((h - pad * 2) / 4) * i
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(w - pad, y)
    ctx.stroke()
  }

  const drawSeries = (data: number[], color: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    data.forEach((v, i) => {
      const x = scaleX(i)
      const y = scaleY(v)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  drawSeries(current, '#38bdf8')
  if (scenario) drawSeries(scenario, '#22c55e')

  return canvas.toDataURL('image/png')
}

function addSectionHeader(doc: jsPDF, label: string, x: number, y: number) {
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text(label, x, y)
}

function addMetricCard(doc: jsPDF, title: string, value: string, x: number, y: number, width = 240, height = 70) {
  doc.setFillColor(18, 26, 45)
  doc.roundedRect(x, y, width, height, 10, 10, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(10)
  doc.text(title, x + 12, y + 20)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(value, x + 12, y + 42)
}

function addTable(doc: jsPDF, rows: string[][], x: number, y: number, colWidths: number[]) {
  const rowHeight = 16
  rows.forEach((row, rowIdx) => {
    let cursorX = x
    row.forEach((cell, i) => {
      const w = colWidths[i]
      doc.setFontSize(rowIdx === 0 ? 10 : 9)
      doc.setTextColor(rowIdx === 0 ? 148 : 220, 163, 184)
      doc.text(cell, cursorX, y + rowHeight * (rowIdx + 1))
      cursorX += w
    })
  })
  return y + rowHeight * rows.length + 4
}

export function Reports() {
  const pl = useAppStore(s => s.pl)
  const scenario = useAppStore(s => s.scenario)
  const [status, setStatus] = useState<string | null>(null)
  const [projectionMonths, setProjectionMonths] = useState(12)
  const [growthPct, setGrowthPct] = useState(3)
  const [includeScenario, setIncludeScenario] = useState(true)

  const baseTotals = useMemo(() => (pl ? computeXeroTotals(pl) : null), [pl])
  const scenarioTotals = useMemo(() => {
    if (!pl || !baseTotals) return null
    if (!scenario.enabled) return null
    return applyBundledScenario(baseTotals, pl, scenario)
  }, [pl, baseTotals, scenario])

  const currentTotal = baseTotals ? sum(baseTotals.net) : 0
  const scenarioTotal = scenarioTotals ? sum(scenarioTotals.net) : null
  const delta = scenarioTotal == null ? 0 : scenarioTotal - currentTotal

  const bestWorst = useMemo(() => {
    if (!baseTotals) return { best: 0, worst: 0 }
    const best = Math.max(...baseTotals.net)
    const worst = Math.min(...baseTotals.net)
    return { best, worst }
  }, [baseTotals])

  const topAccounts = useMemo(() => (pl ? topN(pl.accounts, 8) : []), [pl])
  const opexDrivers = useMemo(
    () => (pl ? topN(pl.accounts.filter(a => a.section === 'operating_expenses'), 6) : []),
    [pl]
  )

  const projectedNet = useMemo(() => {
    if (!baseTotals) return []
    const baseAvg = mean(baseTotals.net)
    const applied = includeScenario && scenarioTotals ? scenarioTotals.net : baseTotals.net
    const start = applied[applied.length - 1] ?? baseAvg
    const growth = (growthPct ?? 0) / 100
    const months = Math.max(1, projectionMonths)
    const out = []
    let val = start
    for (let i = 0; i < months; i++) {
      val = val * (1 + growth)
      out.push(val)
    }
    return out
  }, [baseTotals, scenarioTotals, includeScenario, projectionMonths, growthPct])

  const ensureSpace = (doc: jsPDF, y: number, needed: number, margin: number) => {
    if (y + needed > 780) {
      doc.addPage()
      return margin
    }
    return y
  }

  const generate = async () => {
    if (!pl || !baseTotals) {
      setStatus('Upload P&L first to generate a report.')
      return
    }
    setStatus('Generating...')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    let y = margin

    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F')

    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('Investor Report', margin, y)
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text(`As of ${new Date().toLocaleString()}`, margin, y + 14)

    y += 26
    addMetricCard(doc, 'Current 12-mo profit', money(currentTotal), margin, y)
    addMetricCard(
      doc,
      'Scenario 12-mo profit',
      includeScenario && scenarioTotal != null ? money(scenarioTotal) : 'Scenario off',
      margin + 260,
      y
    )
    addMetricCard(doc, 'Δ vs current', includeScenario && scenarioTotal != null ? money(delta) : '—', margin + 520, y)

    y += 90
    addMetricCard(doc, 'Avg monthly profit', money(mean(baseTotals.net)), margin, y)
    addMetricCard(doc, 'Best / Worst month', `${money(bestWorst.best)} / ${money(bestWorst.worst)}`, margin + 260, y)
    addMetricCard(
      doc,
      'Programs / month',
      scenario.machinesEnabled ? `Derived ${Math.round(scenario.tmsMachines ?? 0)}×${scenario.patientsPerMachinePerWeek ?? 0}` : `${scenario.programMonthlyCount ?? 0} (manual)`,
      margin + 520,
      y
    )

    y += 110
    y = ensureSpace(doc, y, 140, margin)
    addSectionHeader(doc, 'Top accounts (magnitude)', margin, y)
    const topRows = [['Account', 'Section', 'Total'], ...topAccounts.map(a => [a.name, a.section, money(a.total)])]
    y = addTable(doc, topRows, margin, y + 4, [250, 140, 160])

    y = ensureSpace(doc, y, 140, margin)
    addSectionHeader(doc, 'Operating expense drivers', margin, y)
    const opexRows = [['Account', 'Total'], ...opexDrivers.map(a => [a.name, money(a.total)])]
    y = addTable(doc, opexRows, margin, y + 4, [300, 200])

    const trendUrl = buildTrendDataURL(pl.monthLabels, baseTotals?.net ?? [], includeScenario && scenarioTotals ? scenarioTotals.net : null)
    if (trendUrl) {
      y = ensureSpace(doc, y, 240, margin)
      addSectionHeader(doc, 'Net profit trend (current vs scenario)', margin, y)
      doc.addImage(trendUrl, 'PNG', margin, y + 8, 520, 200)
      y += 220
    }

    if (projectedNet.length) {
      y = ensureSpace(doc, y, 160, margin)
      addSectionHeader(doc, `Projection (${projectionMonths} mo @ ${growthPct}%/mo)`, margin, y)
      const projRows = [['Month', 'Projected net']]
      projectedNet.forEach((v, i) => projRows.push([`${i + 1}`, money(v)]))
      y = addTable(doc, projRows, margin, y + 4, [120, 200])
    }

    y = ensureSpace(doc, y, 160, margin)
    addSectionHeader(doc, 'Key assumptions', margin, y)
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    const assumptions = [
      `Programs / month: ${scenario.machinesEnabled ? 'Derived (machines enabled)' : `Manual (${scenario.programMonthlyCount ?? 0})`}`,
      `Rent: ${money((scenario as any).rentFixedMonthly ?? 0)} (${scenario.rentMode === 'percent' ? `${(scenario.rentPercentPerMonth ?? 0).toFixed(1)}% monthly change` : 'fixed'})`,
      `Bundle pricing: CBA ${money(scenario.cbaPrice ?? 0)}, Program ${money(scenario.programPrice ?? 0)}`,
      `Doctor service fee retained: ${(scenario.doctorServiceFeePct ?? 0)}%`,
      `Add bundle costs to scenario: ${scenario.addBundleCostsToScenario ? 'Yes' : 'No'}`,
      `Consults removed: ${scenario.includeDoctorConsultsInBundle ? 'Yes' : 'No'}`,
    ]
    let yy = y + 14
    assumptions.forEach(line => {
      doc.text(`• ${line}`, margin, yy)
      yy += 12
    })

    doc.save('Investor_Report.pdf')
    setStatus('Report generated.')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Investor report</div>
            <div className="text-xs text-slate-400">
              High-fidelity PDF with trend, drivers, projections, and assumptions — configurable below.
            </div>
          </div>
          <Chip tone={scenario.enabled ? 'good' : 'neutral'}>{scenario.enabled ? 'Scenario ON' : 'Scenario OFF'}</Chip>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Projection months</Label>
            <Input
              className="mt-1"
              type="number"
              value={projectionMonths}
              onChange={(e) => setProjectionMonths(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div>
            <Label>Monthly growth (%)</Label>
            <Input
              className="mt-1"
              type="number"
              value={growthPct}
              onChange={(e) => setGrowthPct(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={includeScenario}
                onChange={(e) => setIncludeScenario(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Include scenario overlay
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={generate}
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500/30 disabled:opacity-50"
          disabled={!pl || !baseTotals}
        >
          Generate investor PDF
        </button>
        {status ? <div className="text-xs text-slate-300">{status}</div> : null}
        {!pl ? <div className="text-xs text-amber-200">Upload a P&L to enable reporting.</div> : null}
      </Card>
    </div>
  )
}

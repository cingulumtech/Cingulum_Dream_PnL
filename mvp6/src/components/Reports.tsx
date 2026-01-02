import React, { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { useAppStore } from '../store/appStore'
import { computeXeroTotals, applyBundledScenario } from '../lib/dream/compute'
import { Card, Chip } from './ui'

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (b ?? 0), 0)
}

function buildTrendDataURL(months: string[], current: number[], scenario: number[] | null) {
  const w = 600
  const h = 220
  const pad = 24
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

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    const y = pad + ((h - pad * 2) / 3) * i
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(w - pad, y)
    ctx.stroke()
  }

  const drawSeries = (data: number[], color: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
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

export function Reports() {
  const pl = useAppStore(s => s.pl)
  const scenario = useAppStore(s => s.scenario)
  const [status, setStatus] = useState<string | null>(null)

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

  const topAccounts = useMemo(() => {
    if (!pl) return []
    return [...pl.accounts]
      .map(a => ({ name: a.name, total: a.total, section: a.section }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 6)
  }, [pl])

  const generate = async () => {
    if (!pl || !baseTotals) {
      setStatus('Upload P&L first to generate a report.')
      return
    }
    setStatus('Generating...')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    let y = margin

    const addMetric = (title: string, value: string, x: number) => {
      doc.setFillColor(20, 28, 45)
      doc.roundedRect(x, y, 220, 60, 10, 10, 'F')
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(10)
      doc.text(title, x + 12, y + 20)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text(value, x + 12, y + 42)
    }

    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('Investor Report', margin, y)
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text(`As of ${new Date().toLocaleString()}`, margin, y + 14)

    y += 30
    addMetric('Current 12-mo profit', money(currentTotal), margin)
    addMetric('Scenario 12-mo profit', scenarioTotal == null ? 'Scenario off' : money(scenarioTotal), margin + 240)
    addMetric('Δ profit vs current', money(delta), margin + 480)
    y += 80
    addMetric('Avg monthly profit', money(baseTotals ? sum(baseTotals.net) / baseTotals.net.length : 0), margin)
    addMetric('Best / Worst month', `${money(bestWorst.best)} / ${money(bestWorst.worst)}`, margin + 240)
    addMetric('Enabled?', scenario.enabled ? 'Scenario ON' : 'Scenario OFF', margin + 480)

    y += 90
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.text('Top accounts by magnitude', margin, y)
    y += 12
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(9)
    topAccounts.forEach(a => {
      doc.text(`${a.name}`, margin, y)
      doc.text(`${money(a.total)}  (${a.section})`, margin + 260, y)
      y += 14
    })

    const trendUrl = buildTrendDataURL(pl.monthLabels, baseTotals?.net ?? [], scenarioTotals?.net ?? null)
    if (trendUrl) {
      y += 10
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(12)
      doc.text('Net profit trend (current vs scenario)', margin, y)
      y += 4
      doc.addImage(trendUrl, 'PNG', margin, y, 520, 180)
      y += 190
    }

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.text('Key assumptions', margin, y)
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    const assumptions = [
      `Programs / month: ${scenario.machinesEnabled ? 'Derived' : 'Manual'} (${scenario.machinesEnabled ? 'machines on' : `${scenario.programMonthlyCount ?? 0}`})`,
      `Rent: ${money((scenario as any).rentFixedMonthly ?? 0)} (${scenario.rentMode === 'percent' ? `${(scenario.rentPercentPerMonth ?? 0).toFixed(1)}% monthly change` : 'fixed'})`,
      `CBA price: ${money(scenario.cbaPrice ?? 0)}, Program price: ${money(scenario.programPrice ?? 0)}`,
      `Doctor service fee retained: ${(scenario.doctorServiceFeePct ?? 0)}%`,
    ]
    y += 14
    assumptions.forEach(line => {
      doc.text(`• ${line}`, margin, y)
      y += 12
    })

    doc.save('Investor_Report.pdf')
    setStatus('Report generated.')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Investor report</div>
            <div className="text-xs text-slate-400">Generate a styled PDF with profit trend, top accounts, and key assumptions.</div>
          </div>
          <Chip tone={scenario.enabled ? 'good' : 'neutral'}>{scenario.enabled ? 'Scenario ON' : 'Scenario OFF'}</Chip>
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

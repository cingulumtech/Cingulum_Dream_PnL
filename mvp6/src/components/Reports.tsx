import React, { useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useAppStore } from '../store/appStore'
import { computeXeroTotals, applyBundledScenario } from '../lib/dream/compute'
import { Card, Chip, Input, Label } from './ui'
import { ReportBuilderPanel } from './report/ReportBuilderPanel'
import { ReportPreview } from './report/ReportPreview'
import { InvestorReportTemplate } from './report/InvestorReportTemplate'
import { computeVarianceInsights, computeTrendInsights, computeAnomalyInsights, computeDataQuality } from '../lib/insightEngine'

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
  const [builder, setBuilder] = useState({
    reportType: 'investor' as const,
    period: 'ttm' as const,
    projectionMonths: 12,
    growthPct: 3,
    includeScenario: true,
    confidence: 70,
    preset: 'investor' as const,
    sections: {
      executive: true,
      kpi: true,
      trend: true,
      waterfall: true,
      drivers: true,
      pnl: true,
      cost: true,
      appendix: true,
    },
  })

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
    const applied = builder.includeScenario && scenarioTotals ? scenarioTotals.net : baseTotals.net
    const start = applied[applied.length - 1] ?? baseAvg
    const growth = (builder.growthPct ?? 0) / 100
    const months = Math.max(1, builder.projectionMonths)
    const out = []
    let val = start
    for (let i = 0; i < months; i++) {
      val = val * (1 + growth)
      out.push(val)
    }
    return out
  }, [baseTotals, scenarioTotals, builder.includeScenario, builder.projectionMonths, builder.growthPct])

  const ensureSpace = (doc: jsPDF, y: number, needed: number, margin: number) => {
    if (y + needed > 780) {
      doc.addPage()
      return margin
    }
    return y
  }

  const previewRef = useRef<HTMLDivElement>(null)
  const templateRef = useRef<HTMLDivElement>(null)

  const generate = async () => {
    if (!pl || !baseTotals) {
      setStatus('Upload P&L first to generate a report.')
      return
    }
    setStatus('Generating...')
    if (!templateRef.current) {
      setStatus('Preview not ready.')
      return
    }
    const element = templateRef.current
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0b1222' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
    const imgWidth = canvas.width * ratio
    const imgHeight = canvas.height * ratio
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    pdf.save('Investor_Report.pdf')
    setStatus('Report generated.')
    setTimeout(() => setStatus(null), 2000)
  }

  // Derived content for template
  const insightList = [
    ...computeVarianceInsights(baseTotals?.net, builder.includeScenario ? scenarioTotals?.net ?? undefined : undefined),
    ...computeTrendInsights(baseTotals?.net),
    ...computeAnomalyInsights(baseTotals?.net, pl?.monthLabels),
    ...computeDataQuality(pl),
  ]

  const kpis = [
    { label: 'Current TTM profit', value: money(currentTotal), tone: 'neutral' as const },
    { label: 'Scenario TTM profit', value: builder.includeScenario && scenarioTotal != null ? money(scenarioTotal) : 'Scenario off', tone: 'neutral' as const },
    { label: 'Avg monthly profit', value: money(mean(baseTotals?.net ?? [])), tone: 'neutral' as const },
    { label: 'Best / Worst', value: `${money(bestWorst.best)} / ${money(bestWorst.worst)}`, tone: 'neutral' as const },
  ]

  const trendRows = (pl?.monthLabels ?? []).map((m, i) => ({
    month: m,
    current: baseTotals?.net?.[i] ?? 0,
    scenario: builder.includeScenario ? scenarioTotals?.net?.[i] ?? null : null,
  }))

  const drivers = (scenarioTotals && baseTotals)
    ? topAccounts.map(a => ({
        label: a.name,
        delta: (scenarioTotals.net?.[0] ?? 0) - (baseTotals.net?.[0] ?? 0),
        pct: 'n/a',
      }))
    : []

  const pnlSummary = baseTotals
    ? [
        { label: 'Revenue', current: sum(baseTotals.revenue ?? []), scenario: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.revenue ?? []) : null, variance: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.revenue ?? []) - sum(baseTotals.revenue ?? []) : null },
        { label: 'COGS', current: sum(baseTotals.cogs ?? []), scenario: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.cogs ?? []) : null, variance: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.cogs ?? []) - sum(baseTotals.cogs ?? []) : null },
        { label: 'Gross profit', current: sum(baseTotals.revenue ?? []) - sum(baseTotals.cogs ?? []), scenario: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.revenue ?? []) - sum(scenarioTotals.cogs ?? []) : null, variance: builder.includeScenario && scenarioTotals ? (sum(scenarioTotals.revenue ?? []) - sum(scenarioTotals.cogs ?? [])) - (sum(baseTotals.revenue ?? []) - sum(baseTotals.cogs ?? [])) : null },
        { label: 'Opex', current: sum(baseTotals.opex ?? []), scenario: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.opex ?? []) : null, variance: builder.includeScenario && scenarioTotals ? sum(scenarioTotals.opex ?? []) - sum(baseTotals.opex ?? []) : null },
        { label: 'Net profit', current: currentTotal, scenario: builder.includeScenario && scenarioTotals ? scenarioTotal ?? 0 : null, variance: builder.includeScenario && scenarioTotals ? delta : null },
      ]
    : []

  const template = (
    <InvestorReportTemplate
      company="Cingulum Dream P&L"
      periodLabel={`As of ${new Date().toLocaleDateString()}`}
      kpis={kpis}
      insights={insightList}
      trendRows={trendRows}
      trendStats={{ cagr: 'n/a', volatility: 'n/a', last3vsPrev3: 'see insights' }}
      dataQuality={computeDataQuality(pl).map(i => i.detail)}
      drivers={drivers}
      pnlSummary={pnlSummary}
      waterfall={[]}
      assumptions={[
        `Growth ${builder.growthPct}% monthly for ${builder.projectionMonths} months`,
        builder.includeScenario ? 'Scenario overlay ON' : 'Scenario overlay OFF',
        `Report preset: ${builder.preset}`,
      ]}
    />
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px,1fr]">
      <ReportBuilderPanel
        {...builder}
        onChange={(s) => {
          if (s.preset) {
            if (s.preset === 'investor') {
              setBuilder(prev => ({ ...prev, ...s, sections: { executive: true, kpi: true, trend: true, waterfall: true, drivers: true, pnl: true, cost: true, appendix: true } }))
              return
            }
            if (s.preset === 'scenario') {
              setBuilder(prev => ({ ...prev, ...s, sections: { executive: true, kpi: true, trend: true, waterfall: true, drivers: true, pnl: true, cost: false, appendix: true } }))
              return
            }
            if (s.preset === 'lean') {
              setBuilder(prev => ({ ...prev, ...s, sections: { executive: true, kpi: true, trend: true, waterfall: false, drivers: false, pnl: true, cost: false, appendix: true } }))
              return
            }
          }
          setBuilder(prev => ({ ...prev, ...s }))
        }}
      />

      <div className="space-y-3">
        <ReportPreview previewRef={previewRef} />
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Hidden template for PDF + preview content */}
      <div className="hidden">
        <div ref={templateRef}>{template}</div>
      </div>
      {previewRef.current ? null : null}
    </div>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useAppStore } from '../store/appStore'
import { ReportBuilderPanel } from './report/ReportBuilderPanel'
import { ReportPreview } from './report/ReportPreview'
import { InvestorReportTemplate } from './report/InvestorReportTemplate'
import { Card } from './ui'
import { SaveStatusPill } from './SaveStatus'
import { PageHeader } from './PageHeader'
import { ComparisonMode, DataSource, getReportData } from '../lib/reportData'
import { getPageMetrics, pageSizeForJsPdf, sanitizeColorStyles } from '../lib/reportExport'
import { useAuthStore } from '../store/authStore'
import { buildEffectiveLedger, buildEffectivePl } from '../lib/ledger'

export function Reports() {
  const user = useAuthStore(s => s.user)
  const readOnly = user?.role === 'viewer'
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const scenario = useAppStore(s => s.scenario)
  const dreamTemplate = useAppStore(s => s.template)
  const activeSnapshotId = useAppStore(s => s.activeSnapshotId)
  const defaults = useAppStore(s => s.defaults)
  const reportConfig = useAppStore(s => s.reportConfig)
  const setReportConfig = useAppStore(s => s.setReportConfig)
  const reportSaveStatus = useAppStore(s => s.reportSaveStatus)
  const txnOverrides = useAppStore(s => s.txnOverrides)
  const doctorRules = useAppStore(s => s.doctorRules)

  const [builder, setBuilder] = useState<{ dataSource: DataSource; includeScenario: boolean; comparisonMode: ComparisonMode }>(
    reportConfig ?? { dataSource: 'legacy', includeScenario: true, comparisonMode: 'last3_vs_prev3' }
  )
  const [userChoseSource, setUserChoseSource] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [generatedAt, setGeneratedAt] = useState<Date>(() => new Date())
  const panelClassName = [
    'grid grid-cols-1 gap-4 lg:grid-cols-[360px,1fr]',
    readOnly ? 'pointer-events-none opacity-70' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const snapshotLabel = activeSnapshotId
    ? 'Snapshot in use: ' + activeSnapshotId
    : 'Live data (no snapshot pinned).'

  useEffect(() => {
    setBuilder(reportConfig)
  }, [reportConfig])

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

  const reportData = useMemo(
    () =>
      getReportData({
        dataSource: builder.dataSource,
        pl: effectivePl,
        effectivePl,
        operatingPl,
        template: dreamTemplate,
        scenario,
        includeScenario: builder.includeScenario,
        comparisonMode: builder.comparisonMode,
      }),
    [builder.dataSource, builder.includeScenario, builder.comparisonMode, effectivePl, operatingPl, dreamTemplate, scenario]
  )

  useEffect(() => {
    if (!pl) return
    if (userChoseSource) return
    if (builder.dataSource !== reportData.recommendedSource) {
      setBuilder(prev => {
        const next = { ...prev, dataSource: reportData.recommendedSource }
        setReportConfig(next)
        return next
      })
    }
  }, [pl, reportData.recommendedSource, builder.dataSource, userChoseSource, setReportConfig])

  useEffect(() => {
    setGeneratedAt(new Date())
  }, [builder, pl, dreamTemplate, scenario])

  const handleChange = (s: Partial<typeof builder>) => {
    if ('dataSource' in s) setUserChoseSource(true)
    setBuilder(prev => {
      const next = { ...prev, ...s }
      if ('includeScenario' in s && s.includeScenario !== undefined) {
        if (s.includeScenario && next.comparisonMode === 'last3_vs_prev3') next.comparisonMode = 'scenario_vs_current'
        if (!s.includeScenario && next.comparisonMode === 'scenario_vs_current') next.comparisonMode = 'last3_vs_prev3'
      }
      setReportConfig(next)
      return next
    })
  }

  const generate = async () => {
    if (!reportData.baseTotals) {
      setStatus('Upload P&L first to generate a report.')
      return
    }
    if (!previewRef.current) {
      setStatus('Preview not ready.')
      return
    }
    setStatus('Generating...')
    const element = previewRef.current
    const stamp = new Date()
    setGeneratedAt(stamp)
    const pageBreakTargets = Array.from(element.querySelectorAll<HTMLElement>('.page-break'))
    const metrics = getPageMetrics(defaults.exportSettings)
    const elementWidth = metrics.contentWidthPx
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      windowWidth: elementWidth,
      windowHeight: element.scrollHeight,
      onclone: doc => {
        sanitizeColorStyles(doc)
        const clonedRoot = doc.querySelector<HTMLElement>('.report-root')
        if (clonedRoot) {
          clonedRoot.style.transform = 'none'
          clonedRoot.style.transformOrigin = 'top left'
          clonedRoot.style.width = `${metrics.contentWidthPx}px`
        }
      },
      useCORS: true,
    })
    const pdf = new jsPDF('p', 'pt', pageSizeForJsPdf(metrics.pageSize))
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const printableWidth = pageWidth - metrics.marginPt * 2
    const printableHeight = pageHeight - metrics.marginPt * 2
    const scale = printableWidth / canvas.width
    const imgWidth = printableWidth
    const canvasScale = canvas.width / elementWidth
    const breakpoints = pageBreakTargets
      .map(node => node.offsetTop * canvasScale)
      .filter(bp => bp > 0 && bp < canvas.height)
      .sort((a, b) => a - b)
    const pageHeightCanvas = printableHeight / scale
    let pageStart = 0

    while (pageStart < canvas.height - 1) {
      const pageLimit = pageStart + pageHeightCanvas
      const candidates = breakpoints.filter(bp => bp > pageStart + 20 && bp < pageLimit - 20)
      let pageEnd = candidates.length ? candidates[candidates.length - 1] : pageLimit
      if (pageEnd <= pageStart + 10) {
        pageEnd = pageLimit
      }
      const sliceHeight = Math.min(pageEnd, canvas.height) - pageStart
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceHeight
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, pageStart, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        const sliceData = pageCanvas.toDataURL('image/png')
        if (pageStart > 0) {
          pdf.addPage()
        }
        pdf.addImage(sliceData, 'PNG', metrics.marginPt, metrics.marginPt, imgWidth, sliceHeight * scale)
      }
      pageStart = pageEnd
    }
    pdf.save('Investor_Report.pdf')
    setStatus('Report generated.')
    setTimeout(() => setStatus(null), 2000)
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Reports"
        subtitle="Generate investor-ready exports with your saved configuration."
        actions={<SaveStatusPill status={reportSaveStatus} />}
      />
      {readOnly && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          View-only access enabled. Report configuration changes are disabled.
        </div>
      )}
      <div className={panelClassName}>
        <ReportBuilderPanel
          dataSource={builder.dataSource}
          includeScenario={builder.includeScenario}
          recommendedSource={reportData.recommendedSource}
          mappingCompleteness={reportData.dataQuality.mappingCompleteness}
          mappingWarnings={[
            ...reportData.dataQuality.warnings,
            ...(reportData.fallbackReason ? [reportData.fallbackReason] : []),
            ...(reportData.recommendedSource === 'legacy' && reportData.dataQuality.mappingCompleteness < 0.85
              ? ['Management mapping below 85%. Defaulting to Legacy until more accounts are mapped.']
              : []),
          ]}
          comparisonMode={builder.comparisonMode}
          onChange={handleChange}
        />

        <div className="space-y-3">
          {reportData.fallbackReason && (
            <Card className="p-3 text-xs text-amber-100 border border-amber-400/30 bg-amber-500/10">
              {reportData.fallbackReason}
            </Card>
          )}
          <ReportPreview previewRef={previewRef} exportSettings={defaults.exportSettings}>
            <InvestorReportTemplate
              data={reportData}
              meta={{
                snapshotId: activeSnapshotId,
                generatedAt,
              }}
            />
          </ReportPreview>
          <div className="text-[11px] text-slate-400">{snapshotLabel}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500/30 disabled:opacity-50"
              disabled={!pl || !reportData.baseTotals}
            >
              Generate investor PDF
            </button>
            {status ? <div className="text-xs text-slate-300">{status}</div> : null}
            {!pl ? <div className="text-xs text-amber-200">Upload a P&L to enable reporting.</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

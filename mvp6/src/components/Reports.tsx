import React, { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { useAppStore } from '../store/appStore'
import { ReportBuilderPanel } from './report/ReportBuilderPanel'
import { ReportPreview } from './report/ReportPreview'
import { InvestorReportTemplate } from './report/InvestorReportTemplate'
import { Card } from './ui'
import { ComparisonMode, DataSource, getReportData } from '../lib/reportData'

export function Reports() {
  const pl = useAppStore(s => s.pl)
  const scenario = useAppStore(s => s.scenario)
  const dreamTemplate = useAppStore(s => s.template)

  const [builder, setBuilder] = useState<{ dataSource: DataSource; includeScenario: boolean; comparisonMode: ComparisonMode }>({
    dataSource: 'legacy',
    includeScenario: true,
    comparisonMode: 'last3_vs_prev3',
  })
  const [userChoseSource, setUserChoseSource] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const reportData = useMemo(
    () =>
      getReportData({
        dataSource: builder.dataSource,
        pl,
        template: dreamTemplate,
        scenario,
        includeScenario: builder.includeScenario,
        comparisonMode: builder.comparisonMode,
      }),
    [builder.dataSource, builder.includeScenario, builder.comparisonMode, pl, dreamTemplate, scenario]
  )

  useEffect(() => {
    if (!pl) return
    if (userChoseSource) return
    if (builder.dataSource !== reportData.recommendedSource) {
      setBuilder(prev => ({ ...prev, dataSource: reportData.recommendedSource }))
    }
  }, [pl, reportData.recommendedSource, builder.dataSource, userChoseSource])

  const handleChange = (s: Partial<typeof builder>) => {
    if ('dataSource' in s) setUserChoseSource(true)
    setBuilder(prev => {
      const next = { ...prev, ...s }
      // Auto-align comparison mode when toggling scenario
      if ('includeScenario' in s && s.includeScenario !== undefined) {
        if (s.includeScenario && next.comparisonMode === 'last3_vs_prev3') next.comparisonMode = 'scenario_vs_current'
        if (!s.includeScenario && next.comparisonMode === 'scenario_vs_current') next.comparisonMode = 'last3_vs_prev3'
      }
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px,1fr]">
      <ReportBuilderPanel
        dataSource={builder.dataSource}
        includeScenario={builder.includeScenario}
        recommendedSource={reportData.recommendedSource}
        mappingCompleteness={reportData.dataQuality.mappingCompleteness}
        mappingWarnings={[
          ...reportData.dataQuality.warnings,
          ...(reportData.fallbackReason ? [reportData.fallbackReason] : []),
          ...(reportData.recommendedSource === 'legacy' && reportData.dataQuality.mappingCompleteness < 0.85
            ? ['Dream mapping below 85%. Defaulting to Legacy until more accounts are mapped.']
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
        <ReportPreview previewRef={previewRef}>
          <InvestorReportTemplate data={reportData} />
        </ReportPreview>
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
  )
}

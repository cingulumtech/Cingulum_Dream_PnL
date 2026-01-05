import React from 'react'
import { Card } from '../ui'
import { ExportSettings } from '../../lib/defaults'
import { getPageMetrics } from '../../lib/reportExport'

export function ReportPreview({
  previewRef,
  children,
  exportSettings,
}: {
  previewRef: React.RefObject<HTMLDivElement>
  children: React.ReactNode
  exportSettings: ExportSettings
}) {
  const metrics = getPageMetrics(exportSettings)
  return (
    <Card className="p-3">
      <style>{`
        @page { size: ${metrics.pageLabel}; margin: ${metrics.marginMm}mm; }
        @media print {
          .report-root {
            width: ${metrics.contentWidthPx}px;
            max-width: none;
          }
        }
      `}</style>
      <div className="text-sm font-semibold text-slate-100 mb-2">Report Preview</div>
      <div className="text-xs text-slate-400 mb-2">Live preview of the first pages. Export preserves this layout.</div>
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-3 overflow-auto max-h-[70vh]">
        <div
          ref={previewRef}
          className="origin-top-left report-root"
          style={{ width: `${metrics.contentWidthPx}px`, minHeight: `${metrics.contentHeightPx}px` }}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}

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
        @page { size: A4; margin: 12mm; }
        .report-root {
          width: calc(210mm - 24mm);
          max-width: none;
        }
        @media print {
          .report-root {
            width: ${metrics.contentWidthPx}px;
            max-width: none;
          }
        }
      `}</style>
      <div className="text-sm font-semibold text-slate-100 mb-2">Report Preview</div>
      <div className="text-xs text-slate-400 mb-2">Live preview of the report (A4, scale=2). Exported PDF matches this layout.</div>
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-3 overflow-auto max-h-[70vh]">
        <div
          ref={previewRef}
          className="origin-top-left report-root"
          style={{ width: 'calc(210mm - 24mm)', minHeight: '1122px' }}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}

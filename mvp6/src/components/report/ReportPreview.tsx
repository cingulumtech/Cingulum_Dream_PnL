import React from 'react'
import { Card } from '../ui'

export function ReportPreview({ previewRef, children }: { previewRef: React.RefObject<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <Card className="p-3">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .report-root {
            width: calc(210mm - 24mm);
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
          style={{ width: '794px', minHeight: '1122px' }}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../ui'
import { ExportSettings } from '../../lib/defaults'
import { getPageMetrics } from '../../lib/reportExport'

export const REPORT_PREVIEW_PRINT_CSS = `
  @page { size: A4; margin: 12mm; }
  .report-root {
    width: calc(210mm - 24mm);
    max-width: none;
    background: #ffffff;
    color: #0f172a;
  }
  .report-page {
    background: #ffffff;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 18px;
    box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
  }
  @media print {
    .report-root {
      width: var(--report-content-width);
      max-width: none;
    }
  }
`

export function ReportPreview({
  previewRef,
  children,
  exportSettings,
}: {
  previewRef: React.RefObject<HTMLDivElement>
  children: React.ReactNode
  exportSettings: ExportSettings
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const metrics = getPageMetrics(exportSettings)
  const [fitToWidth, setFitToWidth] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [autoScale, setAutoScale] = useState(1)

  useEffect(() => {
    if (!fitToWidth) return
    const element = containerRef.current
    if (!element) return
    const update = () => {
      const availableWidth = element.clientWidth - 24
      const nextScale = Math.min(1, availableWidth / metrics.contentWidthPx)
      setAutoScale(Number.isFinite(nextScale) ? nextScale : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fitToWidth, metrics.contentWidthPx])

  const scale = useMemo(() => {
    if (fitToWidth) return autoScale
    return Math.max(0.5, Math.min(1.5, zoom / 100))
  }, [fitToWidth, autoScale, zoom])

  const reportRootStyle = {
    width: 'calc(210mm - 24mm)',
    minHeight: '1122px',
    '--report-content-width': `${metrics.contentWidthPx}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  } as React.CSSProperties
  return (
    <Card className="p-3">
      <style>{REPORT_PREVIEW_PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-sm font-semibold text-slate-100">Report Preview</div>
          <div className="text-xs text-slate-400">Live preview of the report (A4). Exported PDF matches this layout.</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fitToWidth} onChange={() => setFitToWidth(v => !v)} />
            Fit to width
          </label>
          {!fitToWidth ? (
            <input
              type="range"
              min={60}
              max={140}
              value={zoom}
              onChange={event => setZoom(Number(event.target.value))}
            />
          ) : null}
          {!fitToWidth ? <span className="text-[11px] text-slate-400">{zoom}%</span> : null}
        </div>
      </div>
      <div ref={containerRef} className="rounded-2xl border border-white/10 bg-slate-950 p-3 overflow-auto max-h-[70vh]">
        <div
          ref={previewRef}
          className="origin-top-left report-root report-page"
          style={reportRootStyle}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}

import { ExportSettings } from './defaults'

const PAGE_DIMENSIONS = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 216, heightMm: 279 },
}

const mmToPx = (mm: number) => (mm * 96) / 25.4
const mmToPt = (mm: number) => (mm * 72) / 25.4

function clampMargin(mm: number, pageWidthMm: number) {
  if (!Number.isFinite(mm)) return 12
  const maxMargin = pageWidthMm / 3
  return Math.max(4, Math.min(maxMargin, mm))
}

export function getPageMetrics(settings: ExportSettings) {
  const dims = PAGE_DIMENSIONS[settings.pageSize] ?? PAGE_DIMENSIONS.a4
  const marginMm = clampMargin(settings.marginMm ?? 12, dims.widthMm)
  const contentWidthMm = Math.max(0, dims.widthMm - marginMm * 2)
  const contentHeightMm = Math.max(0, dims.heightMm - marginMm * 2)

  return {
    pageSize: settings.pageSize ?? 'a4',
    marginMm,
    marginPt: mmToPt(marginMm),
    contentWidthPx: mmToPx(contentWidthMm),
    contentHeightPx: mmToPx(contentHeightMm),
    pageLabel: settings.pageSize === 'letter' ? 'Letter' : 'A4',
  }
}

export function pageSizeForJsPdf(pageSize: ExportSettings['pageSize']) {
  return pageSize === 'letter' ? 'letter' : 'a4'
}

export function sanitizeColorStyles(doc: Document) {
  const view = doc.defaultView
  if (!view) return
  const style = doc.createElement('style')
  style.setAttribute('data-report-export-fallbacks', 'true')
  style.textContent = `
    .glass { background: rgba(22, 34, 45, 0.88); }
    select { background-color: rgba(22, 34, 45, 0.8); }
    .ui-card { background: rgba(22, 34, 45, 0.85); }
    .ui-table-toolbar { background: rgba(16, 24, 32, 0.9); }
    .bg-white\\/5 { background-color: rgba(22, 34, 45, 0.82); }
    .bg-white\\/10 { background-color: rgba(22, 34, 45, 0.95); }
    .text-slate-200 { color: rgb(218, 227, 232); }
  `
  doc.head.appendChild(style)
  const normalizeColor = (value: string) => {
    if (!value) return value
    if (!/color\(|oklch|oklab|lab|lch/i.test(value)) return value
    const probe = doc.createElement('span')
    probe.style.color = value
    doc.body.appendChild(probe)
    const resolved = view.getComputedStyle(probe).color
    probe.remove()
    return resolved || value
  }
  const elements = Array.from(doc.querySelectorAll<HTMLElement>('*'))
  for (const el of elements) {
    const computed = view.getComputedStyle(el)
    if (!computed) continue
    const color = normalizeColor(computed.color)
    const backgroundColor = normalizeColor(computed.backgroundColor)
    const borderColor = normalizeColor(computed.borderColor)
    if (color) el.style.color = color
    if (backgroundColor) el.style.backgroundColor = backgroundColor
    if (borderColor) el.style.borderColor = borderColor
  }
}

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

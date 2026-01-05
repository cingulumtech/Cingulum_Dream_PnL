import { describe, expect, it } from 'vitest'
import { REPORT_PREVIEW_PRINT_CSS } from './ReportPreview'

describe('ReportPreview print CSS', () => {
  it('removes any max-width constraint for the report root in print', () => {
    expect(REPORT_PREVIEW_PRINT_CSS).toContain('max-width: none')
    expect(REPORT_PREVIEW_PRINT_CSS).toContain('.report-root')
  })
})

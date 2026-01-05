import { describe, expect, it } from 'vitest'
import { profitImpactClass } from './InvestorReportTemplate'

describe('InvestorReportTemplate helpers', () => {
  it('returns colour classes based on profit impact', () => {
    expect(profitImpactClass(10)).toMatch(/emerald/)
    expect(profitImpactClass(-5)).toMatch(/rose/)
    expect(profitImpactClass(0)).toMatch(/slate/)
    expect(profitImpactClass(null)).toMatch(/slate/)
  })
})

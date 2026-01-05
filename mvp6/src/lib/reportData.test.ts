import { describe, expect, it } from 'vitest'
import { getReportData } from './reportData'
import { baseScenario, mappedTemplate, samplePl, unmappedTemplate } from '../test/fixtures'

describe('reportData', () => {
  it('falls back to legacy when dream drivers are suspicious/identical', () => {
    const report = getReportData({ dataSource: 'dream', pl: samplePl, template: mappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.dataSourceUsed).toBe('legacy')
    expect(report.fallbackReason).toMatch(/Dream drivers/i)
  })

  it('avoids $0 spam when mapping is missing', () => {
    const report = getReportData({ dataSource: 'dream', pl: samplePl, template: unmappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.drivers.revenue.items.length).toBe(0)
    expect(report.drivers.revenue.disabledReason).toMatch(/mapped data/i)
  })

  it('defaults recommendation to legacy when dream completeness is low', () => {
    const report = getReportData({ dataSource: 'dream', pl: samplePl, template: unmappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.recommendedSource).toBe('legacy')
  })

  it('computes gross margin as a percentage KPI', () => {
    const report = getReportData({ dataSource: 'dream', pl: samplePl, template: mappedTemplate, scenario: baseScenario, includeScenario: false })
    const gm = report.kpis.find(k => k.label === 'Gross margin %')
    expect(gm?.current).toBeCloseTo(((1800 - 540) / 1800) * 100)
  })

  it('suppresses drivers when movement is suspiciously flat', () => {
    const flatPl = {
      ...samplePl,
      accounts: samplePl.accounts.map(a => ({ ...a, values: [100, 100, 100, 101, 101, 101] })),
    }
    const report = getReportData({ dataSource: 'dream', pl: flatPl, template: mappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.drivers.revenue.disabledReason).toMatch(/identical/i)
    expect(report.drivers.revenue.items).toHaveLength(0)
  })
})

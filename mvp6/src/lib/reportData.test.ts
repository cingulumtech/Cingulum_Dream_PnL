import { describe, expect, it } from 'vitest'
import { buildFinancialModel, computeComparison, getReportData } from './reportData'
import { applyBundledScenario, computeXeroTotals } from './dream/compute'
import { DreamTemplate, ScenarioInputs, XeroPL } from './types'

const baseScenario: ScenarioInputs = {
  enabled: false,
  legacyTmsAccountMatchers: [],
  includeDoctorConsultsInBundle: false,
  legacyConsultAccountMatchers: [],
  state: 'NSW/QLD',
  doctorServiceFeePct: 15,
  cbaMonthlyCount: 0,
  programMonthlyCount: 0,
  cbaPrice: 0,
  programPrice: 0,
  addBundleCostsToScenario: false,
  cbaIncludeMRI: false,
  cbaMriCost: 0,
  cbaMriPatientFee: 0,
  cbaIncludeQuicktome: false,
  cbaQuicktomeCost: 0,
  cbaQuicktomePatientFee: 0,
  cbaIncludeCreyos: false,
  cbaCreyosCost: 0,
  cbaCreyosPatientFee: 0,
  cbaIncludeInitialConsult: false,
  cbaInitialConsultFee: 0,
  cbaInitialConsultCount: 0,
  cbaOtherCogsPerAssessment: 0,
  progIncludePostMRI: false,
  progMriCost: 0,
  progMriPatientFee: 0,
  progIncludeQuicktome: false,
  progQuicktomeCost: 0,
  progQuicktomePatientFee: 0,
  progIncludeCreyos: false,
  progCreyosCost: 0,
  progCreyosPatientFee: 0,
  progInclude6WkConsult: false,
  prog6WkConsultFee: 0,
  prog6WkConsultCount: 0,
  progIncludeAdjunctAllowance: false,
  progAdjunctAllowance: 0,
  progInclude6MoConsult: false,
  prog6MoConsultFee: 0,
  prog6MoConsultCount: 0,
  progInclude6MoCreyos: false,
  prog6MoCreyosCost: 0,
  prog6MoCreyosPatientFee: 0,
  progTreatmentDeliveryCost: 0,
  progOtherCogsPerProgram: 0,
  rentEnabled: false,
  rentAccountMatchers: [],
  rentMode: 'fixed',
  rentFixedMonthly: 0,
  rentPercentPerMonth: 0,
  machinesEnabled: false,
  tmsMachines: 0,
  patientsPerMachinePerWeek: 0,
  weeksPerYear: 52,
  utilisation: 0,
  excludedConsultAccounts: [],
  excludedConsultTxnKeys: [],
}

const samplePl: XeroPL = {
  months: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
  monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  accounts: [
    { name: 'Revenue A', section: 'trading_income', values: [100, 100, 100, 200, 200, 200], total: 900 },
    { name: 'Revenue B', section: 'trading_income', values: [100, 100, 100, 200, 200, 200], total: 900 },
    { name: 'Opex', section: 'operating_expenses', values: [50, 50, 50, 60, 60, 60], total: 320 },
  ],
}

const mappedTemplate: DreamTemplate = {
  id: 't',
  name: 'mapped',
  root: {
    id: 'root',
    label: 'root',
    kind: 'group',
    children: [
      {
        id: 'rev',
        label: 'Revenue',
        kind: 'group',
        children: [
          { id: 'rev_a', label: 'Rev A', kind: 'line', mappedAccounts: ['Revenue A'] },
          { id: 'rev_b', label: 'Rev B', kind: 'line', mappedAccounts: ['Revenue B'] },
        ],
      },
      {
        id: 'cogs',
        label: 'COGS',
        kind: 'group',
        children: [
          { id: 'cogs_line', label: 'COGS Line', kind: 'line', mappedAccounts: [] },
        ],
      },
      {
        id: 'opex',
        label: 'Opex',
        kind: 'group',
        children: [
          { id: 'opex_line', label: 'Opex Line', kind: 'line', mappedAccounts: ['Opex'] },
        ],
      },
    ],
  },
}

const unmappedTemplate: DreamTemplate = {
  id: 't2',
  name: 'unmapped',
  root: {
    id: 'root',
    label: 'root',
    kind: 'group',
    children: [
      { id: 'rev', label: 'Revenue', kind: 'group', children: [] },
      { id: 'cogs', label: 'COGS', kind: 'group', children: [] },
      { id: 'opex', label: 'Opex', kind: 'group', children: [] },
    ],
  },
}

describe('reportData', () => {
  it('falls back to legacy when management drivers are suspicious/identical', () => {
    const report = getReportData({ dataSource: 'management', pl: samplePl, template: mappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.dataSourceUsed).toBe('legacy')
    expect(report.fallbackReason).toMatch(/Management drivers/i)
  })

  it('avoids $0 spam when mapping is missing', () => {
    const report = getReportData({ dataSource: 'management', pl: samplePl, template: unmappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.dataSourceUsed).toBe('legacy')
    expect(report.fallbackReason).toMatch(/Defaulted to Legacy/i)
  })

  it('defaults recommendation to legacy when management completeness is low', () => {
    const report = getReportData({ dataSource: 'management', pl: samplePl, template: unmappedTemplate, scenario: baseScenario, includeScenario: false })
    expect(report.recommendedSource).toBe('legacy')
  })

  it('formats gross margin as a percentage in KPIs and summaries', () => {
    const gmPl: XeroPL = {
      months: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
      monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      accounts: [
        { name: 'Revenue', section: 'trading_income', values: [100, 100, 100, 100, 100, 100], total: 600 },
        { name: 'COGS', section: 'cost_of_sales', values: [40, 40, 40, 40, 40, 40], total: 240 },
      ],
    }
    const gmTemplate: DreamTemplate = {
      ...mappedTemplate,
      root: {
        id: 'root',
        label: 'root',
        kind: 'group',
        children: [
          { id: 'rev', label: 'Revenue', kind: 'group', children: [{ id: 'rev_a', label: 'Rev', kind: 'line', mappedAccounts: ['Revenue'] }] },
          { id: 'cogs', label: 'COGS', kind: 'group', children: [{ id: 'cogs_line', label: 'COGS Line', kind: 'line', mappedAccounts: ['COGS'] }] },
          { id: 'opex', label: 'Opex', kind: 'group', children: [] },
        ],
      },
    }

    const report = getReportData({ dataSource: 'management', pl: gmPl, template: gmTemplate, scenario: baseScenario, includeScenario: false })
    const gmSummary = report.pnlSummary.find(l => l.label === 'Gross margin %')
    expect(gmSummary?.format).toBe('percentage')
    expect(gmSummary?.current).toBeCloseTo(60)

    const gmKpi = report.kpis.find(k => k.label === 'Gross margin %')
    expect(gmKpi?.format).toBe('percentage')
    expect(gmKpi?.current).toBeCloseTo(60)
  })

  it('builds a financial model with provenance and aggregates', () => {
    const pl: XeroPL = {
      months: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
      monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      accounts: [
        { name: 'Revenue', section: 'trading_income', values: [100, 120, 140, 160, 180, 200], total: 900 },
        { name: 'Opex', section: 'operating_expenses', values: [50, 50, 50, 60, 60, 60], total: 330 },
      ],
    }
    const template: DreamTemplate = {
      ...mappedTemplate,
      root: {
        id: 'root',
        label: 'root',
        kind: 'group',
        children: [
          { id: 'rev', label: 'Revenue', kind: 'group', children: [{ id: 'rev_a', label: 'Rev', kind: 'line', mappedAccounts: ['Revenue'] }] },
          { id: 'cogs', label: 'COGS', kind: 'group', children: [] },
          { id: 'opex', label: 'Opex', kind: 'group', children: [{ id: 'opex_line', label: 'Opex Line', kind: 'line', mappedAccounts: ['Opex'] }] },
        ],
      },
    }

    const model = buildFinancialModel({
      datasetId: 'ds-1',
      dataSource: 'management',
      pl,
      template,
      scenarioConfig: baseScenario,
      comparisonMode: 'month_vs_prior',
      includeScenario: false,
    })

    expect(model.provenance.datasetId).toBe('ds-1')
    expect(model.aggregatesByMonth).toHaveLength(pl.monthLabels.length)
    expect(model.provenance.dataSourceUsed).toBe('management')
    expect(model.dataQuality.badge).toMatch(/Management/)
  })

  it('preserves driver profitImpact polarity for income vs cost', () => {
    const driverPl: XeroPL = {
      months: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
      monthLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      accounts: [
        { name: 'Revenue A', section: 'trading_income', values: [100, 100, 100, 200, 200, 250], total: 950 },
        { name: 'Revenue B', section: 'trading_income', values: [200, 200, 200, 250, 260, 270], total: 1380 },
        { name: 'Opex', section: 'operating_expenses', values: [50, 55, 55, 70, 75, 80], total: 385 },
      ],
    }
    const driverTemplate: DreamTemplate = {
      ...mappedTemplate,
      root: {
        id: 'root',
        label: 'root',
        kind: 'group',
        children: [
          {
            id: 'rev',
            label: 'Revenue',
            kind: 'group',
            children: [
              { id: 'rev_a', label: 'Rev A', kind: 'line', mappedAccounts: ['Revenue A'] },
              { id: 'rev_b', label: 'Rev B', kind: 'line', mappedAccounts: ['Revenue B'] },
            ],
          },
          {
            id: 'cogs',
            label: 'COGS',
            kind: 'group',
            children: [],
          },
          {
            id: 'opex',
            label: 'Opex',
            kind: 'group',
            children: [{ id: 'opex_line', label: 'Opex Line', kind: 'line', mappedAccounts: ['Opex'] }],
          },
        ],
      },
    }

    const report = getReportData({ dataSource: 'management', pl: driverPl, template: driverTemplate, scenario: baseScenario, includeScenario: false, comparisonMode: 'last3_vs_prev3' })
    expect(report.drivers.revenue.items[0].profitImpact).toBeGreaterThan(0)
    expect(report.drivers.cost.items[0].profitImpact).toBeLessThan(0)
  })

  it('centralises comparison math across modes', () => {
    const baseSeries = [1, 1, 1, 2, 2, 3]
    const scenarioSeries = [2, 2, 2, 3, 3, 4]

    const last3 = computeComparison('last3_vs_prev3', baseSeries, baseSeries)
    expect(last3.currentTotal).toBe(7)
    expect(last3.compareTotal).toBe(3)
    expect(last3.delta).toBe(4)
    expect(last3.label).toMatch(/Last 3/i)

    const month = computeComparison('month_vs_prior', baseSeries, baseSeries)
    expect(month.currentTotal).toBe(3)
    expect(month.compareTotal).toBe(2)
    expect(month.delta).toBe(1)
    expect(month.label).toMatch(/prior month/i)

    const scenario = computeComparison('scenario_vs_current', baseSeries, scenarioSeries, { revenue: [], cogs: [], opex: [], net: [] })
    expect(scenario.currentTotal).toBe(16)
    expect(scenario.compareTotal).toBe(10)
    expect(scenario.delta).toBe(6)
    expect(scenario.label).toMatch(/Scenario/i)
  })

  it('replaces legacy streams with scenario overlays when enabled', () => {
    const scenarioPl: XeroPL = {
      months: ['2024-01', '2024-02'],
      monthLabels: ['Jan', 'Feb'],
      accounts: [{ name: 'Legacy TMS', section: 'trading_income', values: [500, 500], total: 1000 }],
    }
    const baseTotals = computeXeroTotals(scenarioPl)
    const scenarioTotals = applyBundledScenario(baseTotals, scenarioPl, {
      ...baseScenario,
      enabled: true,
      legacyTmsAccountMatchers: ['tms'],
      cbaMonthlyCount: 1,
      cbaPrice: 200,
      programMonthlyCount: 0,
      addBundleCostsToScenario: false,
    })

    expect(baseTotals.revenue[0]).toBe(500)
    expect(scenarioTotals.revenue[0]).toBe(200)
    expect(scenarioTotals.revenue[0]).not.toBe(baseTotals.revenue[0])
  })
})

import { describe, expect, it } from 'vitest'
import { getReportData } from './reportData'
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
})

import { describe, expect, it } from 'vitest'
import { applyBundledScenario } from './compute'
import { baseScenario, samplePl } from '../../test/fixtures'

describe('applyBundledScenario', () => {
  it('removes matched legacy revenue but keeps excluded consult accounts', () => {
    const scenario = {
      ...baseScenario,
      enabled: true,
      legacyTmsAccountMatchers: ['Revenue'],
      includeDoctorConsultsInBundle: true,
      legacyConsultAccountMatchers: ['Consult'],
      excludedConsultAccounts: ['Consult Income'],
      cbaMonthlyCount: 0,
      programMonthlyCount: 0,
    }

    const pl = {
      ...samplePl,
      accounts: [
        ...samplePl.accounts,
        { name: 'Consult Income', section: 'trading_income', values: [50, 50, 50, 50, 50, 50], total: 300 },
      ],
    }

    const base = { revenue: [1000, 1000, 1000, 1500, 1500, 1500], cogs: [0, 0, 0, 0, 0, 0], opex: [0, 0, 0, 0, 0, 0], net: [0, 0, 0, 0, 0, 0] }
    const result = applyBundledScenario(base, pl, scenario)

    expect(result.revenue[0]).toBe(base.revenue[0] - 200) // both revenue accounts removed
    expect(result.revenue[0]).toBeGreaterThanOrEqual(base.revenue[0] - 200) // excluded consult stays
  })

  it('adds replacement bundle revenue and COGS when enabled', () => {
    const scenario = {
      ...baseScenario,
      enabled: true,
      cbaMonthlyCount: 10,
      programMonthlyCount: 5,
      cbaPrice: 100,
      programPrice: 200,
      addBundleCostsToScenario: true,
      cbaIncludeMRI: true,
      cbaMriCost: 10,
      progIncludePostMRI: true,
      progMriCost: 20,
    }

    const base = { revenue: [0, 0, 0, 0, 0, 0], cogs: [0, 0, 0, 0, 0, 0], opex: [0, 0, 0, 0, 0, 0], net: [0, 0, 0, 0, 0, 0] }
    const result = applyBundledScenario(base, samplePl, scenario)

    expect(result.revenue[0]).toBeCloseTo(10 * 100 + 5 * 200)
    expect(result.cogs[0]).toBeGreaterThan(0) // MRI costs applied
  })
})

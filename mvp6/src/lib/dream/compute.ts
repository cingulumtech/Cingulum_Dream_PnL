import { DreamComputed, DreamGroup, DreamLine, DreamTemplate, MonthKey, ScenarioInputs, XeroPL } from '../types'

function flattenLines(node: DreamGroup, out: DreamLine[] = []) {
  for (const child of node.children) {
    if (child.kind === 'line') out.push(child)
    else flattenLines(child, out)
  }
  return out
}

export function computeDream(pl: XeroPL, template: DreamTemplate): DreamComputed {
  const byAccountName: Record<string, number[]> = {}
  for (const a of pl.accounts) byAccountName[a.name] = a.values

  const byLineId: Record<string, number[]> = {}
  const lines = flattenLines(template.root)

  for (const line of lines) {
    const sums = Array(pl.months.length).fill(0)
    for (const accName of line.mappedAccounts) {
      const vals = byAccountName[accName]
      if (!vals) continue
      for (let i = 0; i < sums.length; i++) sums[i] += vals[i] ?? 0
    }
    byLineId[line.id] = sums
  }

  return { months: pl.months, monthLabels: pl.monthLabels, byLineId, byAccountName }
}

export type DreamTotals = {
  revenue: number[]
  cogs: number[]
  opex: number[]
  net: number[]
}


export function computeXeroTotals(pl: XeroPL): DreamTotals {
  const n = pl.months.length
  const revenue = Array(n).fill(0)
  const cogs = Array(n).fill(0)
  const opex = Array(n).fill(0)

  for (const a of pl.accounts) {
    const target =
      a.section === 'trading_income' || a.section === 'other_income'
        ? revenue
        : a.section === 'cost_of_sales'
          ? cogs
          : a.section === 'operating_expenses'
            ? opex
            : null

    if (!target) continue
    for (let i = 0; i < n; i++) target[i] += a.values[i] ?? 0
  }

  const net = Array(n).fill(0).map((_, i) => revenue[i] - cogs[i] - opex[i])
  return { revenue, cogs, opex, net }
}

/**
 * Approximate Depreciation + Amortisation (D&A) by scanning Xero operating-expense
 * account names for depreciation/amortisation keywords.
 *
 * Used for EBITDA rollups (e.g. table footers). Safe if no D&A exists.
 */
export function computeDepAmort(pl: XeroPL): number[] {
  const n = pl.months.length
  const out = Array(n).fill(0)

  for (const a of pl.accounts) {
    if (a.section !== "operating_expenses") continue
    const nm = (a.name || "").toLowerCase()
    if (!/(depreciat|amorti[sz]e|amorti[sz]ation|amort)/.test(nm)) continue

    for (let i = 0; i < n; i++) {
      out[i] += a.values?.[i] ?? 0
    }
  }

  return out
}

export function computeDreamTotals(pl: XeroPL, template: DreamTemplate, computed: DreamComputed): DreamTotals {
  const n = pl.months.length
  const revenue = Array(n).fill(0)
  const cogs = Array(n).fill(0)
  const opex = Array(n).fill(0)

  const sumGroup = (groupId: string, into: number[]) => {
    const g = findGroup(template.root, groupId)
    if (!g) return
    const lines: DreamLine[] = []
    flattenLines(g, lines)
    for (const ln of lines) {
      const vals = computed.byLineId[ln.id] ?? Array(n).fill(0)
      for (let i = 0; i < n; i++) into[i] += vals[i] ?? 0
    }
  }

  sumGroup('rev', revenue)
  sumGroup('cogs', cogs)
  sumGroup('opex', opex)

  const net = Array(n).fill(0).map((_, i) => revenue[i] - cogs[i] - opex[i])
  return { revenue, cogs, opex, net }
}

export function findGroup(root: DreamGroup, id: string): DreamGroup | null {
  if (root.id === id) return root
  for (const child of root.children) {
    if (child.kind === 'group') {
      const hit = findGroup(child, id)
      if (hit) return hit
    }
  }
  return null
}

export function applyBundledScenario(
  base: DreamTotals,
  pl: XeroPL,
  scenario: ScenarioInputs
): DreamTotals {
  if (!scenario.enabled) return base

  const n = pl.months.length
  const revenue = base.revenue.slice()
  const cogs = base.cogs.slice()
  const opex = base.opex.slice()

  // Replacement rule: remove legacy streams (TMS; optionally consults), then add bundle revenue.
  // We operate at the Xero account level for the removal, then add simulated bundle lines.
  const compile = (patterns: string[], fallback?: RegExp[]) => {
    const compiled = (patterns ?? [])
      .map(s => {
        try {
          const trimmed = String(s ?? '').trim()
          if (!trimmed) return null
          return new RegExp(trimmed, 'i')
        } catch {
          return null
        }
      })
      .filter(Boolean) as RegExp[]
    return compiled.length ? compiled : (fallback ?? [])
  }

  const tmsPatterns = compile(scenario.legacyTmsAccountMatchers ?? [])
  const consultPatterns = scenario.includeDoctorConsultsInBundle
    ? compile(scenario.legacyConsultAccountMatchers ?? [])
    : []

  const shouldRemove = (name: string) =>
    (tmsPatterns.length && tmsPatterns.some(re => re.test(name))) ||
    (consultPatterns.length && consultPatterns.some(re => re.test(name)))

  if (tmsPatterns.length || consultPatterns.length) {
    for (const a of pl.accounts) {
      if (!shouldRemove(a.name)) continue

      // Removal affects whichever section the matched account lives in
      const target =
        a.section === 'trading_income' || a.section === 'other_income'
          ? revenue
          : a.section === 'cost_of_sales'
            ? cogs
            : a.section === 'operating_expenses'
              ? opex
              : null

      if (!target) continue
      for (let i = 0; i < n; i++) target[i] -= a.values[i] ?? 0
    }
  }

  // Effective program volume can be derived from TMS capacity (optional).
  const effectiveProgramCount = (() => {
    if (!scenario.machinesEnabled) return scenario.programMonthlyCount ?? 0
    const machines = Math.max(0, scenario.tmsMachines ?? 0)
    const perWeek = Math.max(0, scenario.patientsPerMachinePerWeek ?? 0)
    const util = Math.min(1, Math.max(0, scenario.utilisation ?? 0))
    const weeksPerMonth = Math.max(0, (scenario.weeksPerYear ?? 52) / 12)
    const derived = machines * perWeek * weeksPerMonth * util
    return derived
  })()

  // Bundle economics (2 streams):
  //  - CBA (assessment): meant to cover pre-treatment work-up costs.
  //  - cgTMS program: replaces legacy TMS treatment revenue, and optionally folds consult revenue.
  const cbaRev = (scenario.cbaMonthlyCount ?? 0) * (scenario.cbaPrice ?? 0)
  const progRev = effectiveProgramCount * (scenario.programPrice ?? 0)

  const mriDefault = scenario.state === 'WA' ? 750 : scenario.state === 'VIC' ? 0 : 380

  const doctorPayoutFactor = 1 - Math.min(1, Math.max(0, (scenario.doctorServiceFeePct ?? 15) / 100))
  const doctorActual = (patientFee: number) => (patientFee ?? 0) * doctorPayoutFactor

  const cbaCostsPer =
    (scenario.cbaIncludeMRI ? (scenario.cbaMriCost ?? mriDefault) : 0) +
    (scenario.cbaIncludeQuicktome ? (scenario.cbaQuicktomeCost ?? 0) : 0) +
    (scenario.cbaIncludeCreyos ? (scenario.cbaCreyosCost ?? 0) : 0) +
    (scenario.cbaIncludeInitialConsult
      ? doctorActual(scenario.cbaInitialConsultFee ?? 0) * (scenario.cbaInitialConsultCount ?? 0)
      : 0) +
    (scenario.cbaOtherCogsPerAssessment ?? 0)

  // cgTMS: Creyos is billed once in CBA (not repeated here)
  const progConsultsPerPatient = scenario.progInclude6WkConsult
    ? doctorActual(scenario.prog6WkConsultFee ?? 0) * (scenario.prog6WkConsultCount ?? 0) * 2
    : 0

  const progCostsPer =
    (scenario.progIncludePostMRI ? (scenario.progMriCost ?? mriDefault) : 0) +
    (scenario.progIncludeQuicktome ? (scenario.progQuicktomeCost ?? 0) : 0) +
    progConsultsPerPatient +
    (scenario.progIncludeAdjunctAllowance ? (scenario.progAdjunctAllowance ?? 0) : 0) +
    (scenario.progTreatmentDeliveryCost ?? 0) +
    (scenario.progOtherCogsPerProgram ?? 0)

  const cbaCogs = (scenario.cbaMonthlyCount ?? 0) * (scenario.addBundleCostsToScenario ? cbaCostsPer : 0)
  const progCogs = effectiveProgramCount * (scenario.addBundleCostsToScenario ? progCostsPer : 0)

  for (let i = 0; i < n; i++) {
    revenue[i] += cbaRev + progRev
    cogs[i] += cbaCogs + progCogs
  }

  // High-leverage opex levers: rent adjustment.
  if (scenario.rentEnabled) {
    const rentPatterns = compile(scenario.rentAccountMatchers ?? [], [/rent/i, /lease/i])
    const baseRent = Array(n).fill(0)
    if (rentPatterns.length) {
      for (const a of pl.accounts) {
        if (a.section !== 'operating_expenses') continue
        if (!rentPatterns.some(re => re.test(a.name))) continue
        for (let i = 0; i < n; i++) baseRent[i] += a.values[i] ?? 0
      }
    }

    // If we couldn't match rent accounts, treat base rent as 0 and only apply fixed delta.
    if (scenario.rentMode === 'fixed') {
      const fixed = scenario.rentFixedMonthly ?? 0
      for (let i = 0; i < n; i++) {
        const delta = fixed - baseRent[i]
        opex[i] += delta
      }
    } else {
      const pct = (scenario.rentPercentPerMonth ?? 0) / 100
      for (let i = 0; i < n; i++) {
        const target = baseRent[i] * Math.pow(1 + pct, i)
        const delta = target - baseRent[i]
        opex[i] += delta
      }
    }
  }

  const net = Array(n).fill(0).map((_, i) => revenue[i] - cogs[i] - opex[i])
  return { revenue, cogs, opex, net }
}

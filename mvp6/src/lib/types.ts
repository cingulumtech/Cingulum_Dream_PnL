export type MonthKey = string // 'YYYY-MM'

export type XeroPLSection =
  | 'trading_income'
  | 'cost_of_sales'
  | 'other_income'
  | 'operating_expenses'
  | 'unknown'

export type XeroPLAccount = {
  name: string
  section: XeroPLSection
  values: number[] // aligned to months
  total: number
}

export type XeroPL = {
  months: MonthKey[]
  monthLabels: string[] // human labels
  accounts: XeroPLAccount[]
}

export type GLTxn = {
  account: string
  date: string // ISO date
  source?: string
  description?: string
  reference?: string
  debit: number
  credit: number
  amount: number // debit-credit (positive = debit)
}

export type GL = {
  txns: GLTxn[]
}

export type DreamNodeId = string

export type DreamLine = {
  id: DreamNodeId
  label: string
  kind: 'line'
  // if empty => computed line remains 0 until mapped
  mappedAccounts: string[]
}

export type DreamGroup = {
  id: DreamNodeId
  label: string
  kind: 'group'
  children: (DreamGroup | DreamLine)[]
}

export type DreamTemplate = {
  id: string
  name: string
  root: DreamGroup
}

export type DreamComputed = {
  months: MonthKey[]
  monthLabels: string[]
  byLineId: Record<DreamNodeId, number[]>
  byAccountName: Record<string, number[]>
}

export type ScenarioInputs = {
  enabled: boolean
  legacyTmsAccountMatchers: string[] // regex-like strings

  // If consult revenue is folded into the bundle, remove it so we don't double-count.
  includeDoctorConsultsInBundle: boolean
  legacyConsultAccountMatchers: string[] // regex-like strings

  // Clinic state affects MRI defaults + suggested bundle prices
  state: 'NSW/QLD' | 'WA' | 'VIC'

  // Doctor service fee retained by clinic (global).
  // Example: 15% means doctor payout (actual cost) = 85% of the patient fee.
  doctorServiceFeePct: number

  // Core volumes (per month)
  cbaMonthlyCount: number
  programMonthlyCount: number

  // Revenue (price charged to patient)
  cbaPrice: number
  programPrice: number

  // Cost treatment
  // If true, we ADD per-patient bundle costs into scenario COGS (conservative).
  // If false, the scenario only changes revenue (replacement modelling) and assumes costs already exist in the P&L.
  addBundleCostsToScenario: boolean

  // CBA inclusions (cost-per-assessment)
  cbaIncludeMRI: boolean
  cbaMriCost: number
  cbaMriPatientFee: number
  cbaIncludeQuicktome: boolean
  cbaQuicktomeCost: number
  cbaQuicktomePatientFee: number
  cbaIncludeCreyos: boolean
  cbaCreyosCost: number
  cbaCreyosPatientFee: number
  cbaIncludeInitialConsult: boolean
  cbaInitialConsultFee: number // patient fee
  cbaInitialConsultCount: number
  cbaOtherCogsPerAssessment: number

  // cgTMS program inclusions (cost-per-program)
  progIncludePostMRI: boolean
  progMriCost: number
  progMriPatientFee: number
  progIncludeQuicktome: boolean
  progQuicktomeCost: number
  progQuicktomePatientFee: number
  // Creyos is billed once in CBA (not repeated in cgTMS bundle)
  progIncludeCreyos: boolean
  progCreyosCost: number
  progCreyosPatientFee: number
  progInclude6WkConsult: boolean
  prog6WkConsultFee: number // patient fee
  prog6WkConsultCount: number
  progIncludeAdjunctAllowance: boolean
  progAdjunctAllowance: number
  // 6-month consult is auto-included when 6-week consult exists
  progInclude6MoConsult: boolean
  prog6MoConsultFee: number // patient fee
  prog6MoConsultCount: number
  progInclude6MoCreyos: boolean
  prog6MoCreyosCost: number
  prog6MoCreyosPatientFee: number
  // Unmodelled delivery cost of cgTMS sessions (staffing, consumables, etc.)
  progTreatmentDeliveryCost: number
  progOtherCogsPerProgram: number

  // =============================
  // Shifting-the-needle levers
  // =============================
  // Rent is a high-leverage fixed cost.
  rentEnabled: boolean
  rentAccountMatchers: string[]
  rentMode: 'fixed' | 'percent'
  // Fixed mode: sets rent to a new monthly amount.
  rentFixedMonthly: number
  // Percent mode: applies a monthly compounding % change (e.g. -2 means -2% per month).
  rentPercentPerMonth: number

  // TMS capacity lever.
  // If enabled, programMonthlyCount is derived from machine capacity.
  machinesEnabled: boolean
  tmsMachines: number
  patientsPerMachinePerWeek: number
  weeksPerYear: number
  utilisation: number // 0..1

  excludedConsultAccounts?: string[]
  excludedConsultTxnKeys?: string[]
}

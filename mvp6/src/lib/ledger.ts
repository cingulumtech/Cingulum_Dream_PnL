import { DeferralConfig, DoctorRule, GLTxn, MonthKey, TxnOverride, TxnTreatment, XeroPL, XeroPLAccount } from './types'

export type EffectiveTxn = GLTxn & {
  key: string
  month: MonthKey
  treatment: TxnTreatment
  nonOperating: boolean
  deferral?: DeferralConfig | null
  originalDate?: string
  doctorContactId?: string | null
  doctorLabel?: string | null
  billId?: string | null
  isBill?: boolean
  isPayment?: boolean
}

export const DEFAULT_DOCTOR_PATTERNS = ['ryan', 'roytowski', 'teo', 'roberts', 'ho', 'lesslar']

export function monthKeyFromDate(date: string): MonthKey {
  return date?.slice(0, 7)
}

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export function buildTxnHash(txn: GLTxn) {
  const raw = [
    txn.account,
    txn.date,
    txn.amount,
    txn.description ?? '',
    txn.reference ?? '',
    txn.source ?? '',
  ].join('|')
  return hashString(raw)
}

export function inferDoctorLabel(txn: GLTxn) {
  const haystack = `${txn.description ?? ''} ${txn.reference ?? ''}`.trim()
  if (!haystack) return null
  const match = haystack.match(/(?:dr\.?\s+|doctor\s+)([a-z][a-z'\-]*(?:\s+[a-z][a-z'\-]*){0,2})/i)
  if (match?.[1]) return `Dr ${match[1].trim()}`
  return null
}

export function normalizeContactId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function isApBillTxn(txn: GLTxn) {
  const source = (txn.source ?? '').toLowerCase()
  const desc = (txn.description ?? '').toLowerCase()
  const acct = (txn.account ?? '').toLowerCase()
  return acct.includes('payable') || source.includes('bill') || desc.includes('bill')
}

export function isPaymentTxn(txn: GLTxn) {
  const source = (txn.source ?? '').toLowerCase()
  const desc = (txn.description ?? '').toLowerCase()
  return source.includes('payment') || desc.includes('payment')
}

export function buildDeferralSchedule(amount: number, config: DeferralConfig) {
  const months = Math.max(1, Math.round(config.months))
  const cents = Math.round(amount * 100)
  const base = Math.trunc(cents / months)
  const remainder = cents - base * months
  const out: { month: MonthKey; amount: number }[] = []
  const [startYear, startMonth] = config.startMonth.split('-').map(Number)
  for (let i = 0; i < months; i++) {
    const date = new Date(Date.UTC(startYear, (startMonth ?? 1) - 1 + i, 1))
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` as MonthKey
    const centsValue = base + (i === months - 1 ? remainder : 0)
    out.push({ month: monthKey, amount: centsValue / 100 })
  }
  return out
}

export function buildEffectiveLedger(
  txns: GLTxn[],
  overrides: TxnOverride[] = [],
  doctorRules: DoctorRule[] = []
): EffectiveTxn[] {
  const overrideMap = new Map<string, TxnOverride>()
  overrides.forEach(o => {
    if (o.hash) overrideMap.set(o.hash, o)
  })
  const ruleMap = new Map<string, DoctorRule>()
  doctorRules.forEach(r => {
    if (r.enabled) ruleMap.set(r.contact_id, r)
  })

  const effective: EffectiveTxn[] = []

  txns.forEach(txn => {
    const key = buildTxnHash(txn)
    const month = monthKeyFromDate(txn.date)
    const doctorLabel = inferDoctorLabel(txn)
    const doctorContactId = doctorLabel ? normalizeContactId(doctorLabel) : null
    const rule = doctorContactId ? ruleMap.get(doctorContactId) : null
    const override = overrideMap.get(key)
    const resolved = resolveTreatment({ txn, override, rule })
    const treatment = resolved.treatment
    const deferral = resolved.deferral

    if (treatment === 'EXCLUDE') {
      return
    }

    if (treatment === 'DEFERRED' && deferral) {
      const schedule = buildDeferralSchedule(txn.amount, deferral)
      schedule.forEach((entry, idx) => {
        effective.push({
          ...txn,
          amount: entry.amount,
          date: `${entry.month}-01`,
          key: `${key}-def-${idx}`,
          month: entry.month,
          treatment,
          nonOperating: !deferral.includeInOperatingKPIs,
          deferral,
          originalDate: txn.date,
          doctorContactId,
          doctorLabel,
          billId: txn.reference ?? txn.description ?? key,
          isBill: isApBillTxn(txn) && !isPaymentTxn(txn),
          isPayment: isPaymentTxn(txn),
        })
      })
      return
    }

    effective.push({
      ...txn,
      key,
      month,
      treatment,
      nonOperating: treatment === 'NON_OPERATING',
      deferral,
      originalDate: txn.date,
      doctorContactId,
      doctorLabel,
      billId: txn.reference ?? txn.description ?? key,
      isBill: isApBillTxn(txn) && !isPaymentTxn(txn),
      isPayment: isPaymentTxn(txn),
    })
  })

  return effective
}

export function buildEffectivePl(pl: XeroPL, ledgerRows: EffectiveTxn[], includeNonOperating = true): XeroPL {
  const monthIndex = new Map(pl.months.map((m, idx) => [m, idx]))
  const accountMap: Record<string, number[]> = {}
  const accountSectionMap = new Map<string, XeroPLAccount['section']>(
    pl.accounts.map(account => [account.name, account.section])
  )

  ledgerRows.forEach(row => {
    if (!includeNonOperating && row.nonOperating) return
    const idx = monthIndex.get(row.month)
    if (idx == null) return
    if (!accountMap[row.account]) {
      accountMap[row.account] = Array(pl.months.length).fill(0)
    }
    const section = accountSectionMap.get(row.account)
    const signedAmount = section === 'trading_income' || section === 'other_income' ? -row.amount : row.amount
    accountMap[row.account][idx] += signedAmount
  })

  const accounts: XeroPLAccount[] = pl.accounts.map(account => ({
    ...account,
    values: accountMap[account.name] ?? account.values,
    total: (accountMap[account.name] ?? account.values).reduce((sum, v) => sum + (v ?? 0), 0),
  }))

  return {
    ...pl,
    accounts,
  }
}

export function getOverrideKey(txn: GLTxn) {
  return buildTxnHash(txn)
}

export function resolveTreatment({
  txn,
  override,
  rule,
}: {
  txn: GLTxn
  override?: TxnOverride
  rule?: DoctorRule | null
}) {
  const month = monthKeyFromDate(txn.date)
  const treatment = (override?.treatment ?? rule?.default_treatment ?? 'OPERATING') as TxnTreatment
  const deferral: DeferralConfig | null =
    treatment === 'DEFERRED'
      ? {
          method: 'STRAIGHT_LINE',
          startMonth: (override?.deferral_start_month ?? rule?.deferral_start_month ?? month) as MonthKey,
          months: override?.deferral_months ?? rule?.deferral_months ?? 12,
          includeInOperatingKPIs:
            override?.deferral_include_in_operating_kpis ?? rule?.deferral_include_in_operating_kpis ?? true,
        }
      : null

  return { treatment, deferral }
}

export type EffectiveLedgerResult = {
  rows: EffectiveTxn[]
}

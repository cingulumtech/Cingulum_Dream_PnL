import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../store/appStore'
import { applyBundledScenario, computeXeroTotals } from '../lib/dream/compute'
import { Button, Card, Chip, Input, Label } from './ui'
import { CopyAffordance } from './CopyAffordance'
import { createCopyMenuItems, useContextMenu } from './ContextMenu'
import { api } from '../lib/api'
import { PageHeader } from './PageHeader'
import {
  buildEffectiveLedger,
  buildEffectivePl,
  buildTxnHash,
  DEFAULT_DOCTOR_PATTERNS,
  inferDoctorLabel,
  isApBillTxn,
  isPaymentTxn,
  normalizeContactId,
  resolveTreatment,
} from '../lib/ledger'
import { TxnTreatment } from '../lib/types'

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (b ?? 0), 0)
}

function avg(arr: number[]) {
  return arr.length ? sum(arr) / arr.length : 0
}

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

function moneyShort(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return money(n)
}

const SECTION_LABEL: Record<string, string> = {
  trading_income: 'Revenue',
  other_income: 'Revenue',
  cost_of_sales: 'COGS',
  operating_expenses: 'OpEx',
  unknown: 'Other',
}

function toNum(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizeTokens(patterns: string[], fallback: string[] = []) {
  const cleaned = (patterns ?? []).map(s => String(s ?? '').trim().toLowerCase()).filter(Boolean)
  const fallbackTokens = fallback.map(s => s.toLowerCase())
  return cleaned.length ? cleaned : fallbackTokens
}

function tokenMatch(name: string, tokens: string[]) {
  if (!tokens.length) return false
  const lower = name.toLowerCase()
  return tokens.some(token => lower.includes(token))
}

function OverviewTooltip({ active, payload, label, showScenario }: any) {
  if (!active || !payload || !payload.length) return null
  const byKey: Record<string, any> = {}
  for (const p of payload) {
    if (p?.dataKey) byKey[p.dataKey] = p
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl px-4 py-3">
      <div className="text-sm font-semibold text-slate-100">{label}</div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="font-semibold" style={{ color: byKey.current?.stroke ?? "#E2E8F0" }}>current</span>
          <span className="font-semibold" style={{ color: byKey.current?.stroke ?? "#F8FAFC" }}>{money(Number(byKey.current?.value ?? 0))}</span>
        </div>
        {showScenario && byKey.scenario && (
          <div className="flex items-center justify-between gap-6">
            <span className="font-semibold" style={{ color: byKey.scenario?.stroke ?? "#E2E8F0" }}>scenario</span>
            <span className="font-semibold" style={{ color: byKey.scenario?.stroke ?? "#F8FAFC" }}>{money(Number(byKey.scenario?.value ?? 0))}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function suggestedCbaPrice(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.suggestedCbaPrice[state]
}

function suggestedProgramPrice(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.suggestedProgramPrice[state]
}

function mriDefaultForState(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.mriCostByState[state]
}

function mriPatientForState(state: 'NSW/QLD' | 'WA' | 'VIC', defaults: any) {
  return defaults.mriPatientByState[state]
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ' +
          (checked ? 'border-emerald-500/30 bg-emerald-500/25' : 'border-white/10 bg-white/5 hover:bg-white/10')
        }
      >
        <span
          className={
            'inline-block h-4 w-4 rounded-full bg-white/80 transition-transform ' +
            (checked ? 'translate-x-6' : 'translate-x-1')
          }
        />
      </button>
      {label ? <span className="text-xs font-semibold text-slate-100">{label}</span> : null}
    </div>
  )
}

function CostItem(props: {
  title: string
  subtitle?: string
  checked: boolean
  onChecked: (v: boolean) => void
  actual: number
  onActual: (n: number) => void
  patientFee: number
  onPatientFee: (n: number) => void
  toggleable?: boolean
  showPatientFee?: boolean
}) {
  const {
    title,
    subtitle,
    checked,
    onChecked,
    actual,
    onActual,
    patientFee,
    onPatientFee,
    toggleable = true,
    showPatientFee = true,
  } = props
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        {toggleable ? <ToggleSwitch checked={checked} onChange={onChecked} /> : null}
      </div>
      <div className={'mt-3 grid grid-cols-1 gap-3 ' + (showPatientFee ? 'sm:grid-cols-2' : '')}>
        {showPatientFee ? (
          <div>
            <Label>Patient fee (shown to patient)</Label>
            <Input
              className="mt-2"
              type="number"
              value={patientFee}
              onChange={(e) => onPatientFee(toNum(e.target.value))}
              disabled={toggleable ? !checked : false}
            />
          </div>
        ) : null}
        <div>
          <Label>Actual cost (your cost)</Label>
          <Input
            className="mt-2"
            type="number"
            value={actual}
            onChange={(e) => onActual(toNum(e.target.value))}
            disabled={toggleable ? !checked : false}
          />
        </div>
      </div>
    </div>
  )
}

function ConsultCostItem(props: {
  title: string
  subtitle?: string
  checked: boolean
  onChecked: (v: boolean) => void
  count: number
  onCount: (n: number) => void
  patientFee: number
  onPatientFee: (n: number) => void
  serviceFeePct: number
  patientCount: number
  patientLabel: string
  readOnly?: boolean
  note?: string
}) {
  const { title, subtitle, checked, onChecked, count, onCount, patientFee, onPatientFee, serviceFeePct, patientCount, patientLabel, readOnly = false, note } = props
  const payoutFactor = 1 - Math.min(1, Math.max(0, (serviceFeePct ?? 0) / 100))
  const actualPerConsult = (patientFee ?? 0) * payoutFactor
  const actualPerPatient = actualPerConsult * (count ?? 0)
  const perMonth = actualPerPatient * (patientCount ?? 0)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <ToggleSwitch checked={checked} onChange={onChecked} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Consults per patient</Label>
          <Input
            className="mt-2"
            type="number"
            value={count}
            onChange={(e) => onCount(toNum(e.target.value))}
            disabled={!checked || readOnly}
          />
        </div>
        <div>
          <Label>Patient fee per consult</Label>
          <Input
            className="mt-2"
            type="number"
            value={patientFee}
            onChange={(e) => onPatientFee(toNum(e.target.value))}
            disabled={!checked || readOnly}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          Actual payout per consult:{' '}
          <span className="font-semibold text-slate-100">{money(actualPerConsult)}</span>
          <span className="text-slate-400">(service fee {serviceFeePct}% retained)</span>
        </div>
        <div>
          Actual cost per patient (this line): <span className="font-semibold text-slate-100">{money(actualPerPatient)}</span>
        </div>
        <div className="text-slate-400">
          Monthly total at {patientLabel} {patientCount}: <span className="text-slate-200">{money(perMonth)}</span>
        </div>
        {note ? <div className="text-slate-400">{note}</div> : null}
      </div>
    </div>
  )
}

export function Overview() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const plLoadedAt = useAppStore(s => s.plLoadedAt)
  const glLoadedAt = useAppStore(s => s.glLoadedAt)
  const scenario = useAppStore(s => s.scenario)
  const setScenario = useAppStore(s => s.setScenario)
  const defaults = useAppStore(s => s.defaults)
  const txnOverrides = useAppStore(s => s.txnOverrides)
  const doctorRules = useAppStore(s => s.doctorRules)
  const doctorPatterns = useAppStore(s => s.doctorPatterns)
  const setDoctorPatterns = useAppStore(s => s.setDoctorPatterns)
  const upsertDoctorRule = useAppStore(s => s.upsertDoctorRule)
  const removeDoctorRule = useAppStore(s => s.removeDoctorRule)
  const upsertTxnOverride = useAppStore(s => s.upsertTxnOverride)
  const removeTxnOverride = useAppStore(s => s.removeTxnOverride)
  const { openMenu, pushToast } = useContextMenu()
  const prefersReducedMotion = useReducedMotion()
  const [consultModalOpen, setConsultModalOpen] = useState(false)
  const [consultMode, setConsultMode] = useState<'ap_bills' | 'mapped_accounts' | 'all_txns'>('ap_bills')
  const [doctorPatternDraft, setDoctorPatternDraft] = useState('')
  const [doctorPatternErrors, setDoctorPatternErrors] = useState<string[]>([])
  const [doctorFilterEnabled, setDoctorFilterEnabled] = useState(true)
  const [consultSearch, setConsultSearch] = useState('')
  const [consultStatusFilter, setConsultStatusFilter] = useState<'all' | 'paid' | 'part-paid' | 'unpaid'>('all')
  const [consultStart, setConsultStart] = useState('')
  const [consultEnd, setConsultEnd] = useState('')
  const [consultMin, setConsultMin] = useState('')
  const [consultMax, setConsultMax] = useState('')
  const [consultAmountSign, setConsultAmountSign] = useState<'all' | 'positive' | 'negative'>('all')
  const [consultDoctorFilter, setConsultDoctorFilter] = useState<string[]>([])
  const [consultAccountFilters, setConsultAccountFilters] = useState<string[]>([])
  const [tmsAccountSearch, setTmsAccountSearch] = useState('')
  const [consultAccountSearch, setConsultAccountSearch] = useState('')
  const [tmsAccountFilter, setTmsAccountFilter] = useState<'all' | 'revenue' | 'cogs' | 'opex'>('revenue')
  const [consultAccountFilter, setConsultAccountFilter] = useState<'all' | 'revenue' | 'cogs' | 'opex'>('revenue')
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false)
  const [consultSelectorOpen, setConsultSelectorOpen] = useState(false)
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false)
  const [setupStep, setSetupStep] = useState<1 | 2 | 3 | 4>(1)
  const [tmsDraftAccounts, setTmsDraftAccounts] = useState<string[]>(scenario.legacyTmsAccounts ?? [])
  const [consultDraftAccounts, setConsultDraftAccounts] = useState<string[]>(scenario.legacyConsultAccounts ?? [])
  const [consultExcludedDraft, setConsultExcludedDraft] = useState<string[]>(scenario.excludedConsultAccounts ?? [])
  const [consultViews, setConsultViews] = useState<
    { name: string; search: string; status: string; start: string; end: string; min: string; max: string; mode: string }[]
  >([])
  const [consultViewName, setConsultViewName] = useState('')
  const [consultAccountSuggestionsAccepted, setConsultAccountSuggestionsAccepted] = useState(false)
  const [doctorAccountSuggestionsAccepted, setDoctorAccountSuggestionsAccepted] = useState(false)
  const [powerToolsOpen, setPowerToolsOpen] = useState(false)
  const activeDoctorPatterns = doctorPatterns.length ? doctorPatterns : DEFAULT_DOCTOR_PATTERNS

  useEffect(() => {
    if (!consultModalOpen) return
    setDoctorPatternDraft(activeDoctorPatterns.join('\n'))
    setDoctorPatternErrors([])
  }, [consultModalOpen, activeDoctorPatterns])

  useEffect(() => {
    setTmsDraftAccounts(scenario.legacyTmsAccounts ?? [])
    setConsultDraftAccounts(scenario.legacyConsultAccounts ?? [])
    setConsultExcludedDraft(scenario.excludedConsultAccounts ?? [])
  }, [scenario.legacyTmsAccounts, scenario.legacyConsultAccounts, scenario.excludedConsultAccounts])

  useEffect(() => {
    const raw = window.localStorage.getItem('atlas-consult-views')
    if (!raw) return
    try {
      setConsultViews(JSON.parse(raw))
    } catch {
      setConsultViews([])
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('atlas-consult-views', JSON.stringify(consultViews))
  }, [consultViews])

  const effectiveLedger = useMemo(
    () => (gl ? buildEffectiveLedger(gl.txns, txnOverrides, doctorRules) : null),
    [gl, txnOverrides, doctorRules]
  )
  const effectivePl = useMemo(
    () =>
      pl && effectiveLedger
        ? buildEffectivePl(pl, effectiveLedger, true, gl?.txns.map(row => row.account))
        : pl,
    [pl, effectiveLedger, gl]
  )
  const operatingPl = useMemo(
    () =>
      pl && effectiveLedger
        ? buildEffectivePl(pl, effectiveLedger, false, gl?.txns.map(row => row.account))
        : pl,
    [pl, effectiveLedger, gl]
  )

  const operatingTotals = useMemo(() => (operatingPl ? computeXeroTotals(operatingPl) : null), [operatingPl])
  const netTotals = useMemo(() => (effectivePl ? computeXeroTotals(effectivePl) : null), [effectivePl])
  const baseTotals = useMemo(() => {
    if (!operatingTotals) return null
    if (!netTotals) return operatingTotals
    return { ...operatingTotals, net: netTotals.net }
  }, [operatingTotals, netTotals])

  const filterAccountList = (
    list: { name: string; section: string }[],
    query: string,
    filter: 'all' | 'revenue' | 'cogs' | 'opex'
  ) => {
    const needle = query.toLowerCase()
    return list.filter(acc => {
      if (filter === 'revenue' && !(acc.section === 'trading_income' || acc.section === 'other_income')) return false
      if (filter === 'cogs' && acc.section !== 'cost_of_sales') return false
      if (filter === 'opex' && acc.section !== 'operating_expenses') return false
      if (needle && !acc.name.toLowerCase().includes(needle)) return false
      return true
    })
  }

  const filteredTmsAccounts = useMemo(
    () => (operatingPl ? filterAccountList(operatingPl.accounts, tmsAccountSearch, tmsAccountFilter) : []),
    [operatingPl, tmsAccountSearch, tmsAccountFilter]
  )
  const filteredConsultAccounts = useMemo(
    () => (operatingPl ? filterAccountList(operatingPl.accounts, consultAccountSearch, consultAccountFilter) : []),
    [operatingPl, consultAccountSearch, consultAccountFilter]
  )

  const derivedProgramCount = useMemo(() => {
    if (!scenario.machinesEnabled) return null
    const machines = Math.max(0, scenario.tmsMachines ?? 0)
    const perWeek = Math.max(0, scenario.patientsPerMachinePerWeek ?? 0)
    const util = Math.min(1, Math.max(0, scenario.utilisation ?? 0))
    const weeksPerMonth = Math.max(0, (scenario.weeksPerYear ?? 52) / 12)
    return machines * perWeek * weeksPerMonth * util
  }, [scenario.machinesEnabled, scenario.tmsMachines, scenario.patientsPerMachinePerWeek, scenario.utilisation, scenario.weeksPerYear])

  const baseRentLatest = useMemo(() => {
    if (!operatingPl) return null
    const tokens = normalizeTokens(scenario.rentAccountMatchers ?? [], ['rent', 'lease'])
    if (!tokens.length) return null
    let latest: number | null = null
    for (const a of operatingPl.accounts) {
      if (a.section !== 'operating_expenses') continue
      if (!tokenMatch(a.name, tokens)) continue
      for (let i = operatingPl.monthLabels.length - 1; i >= 0; i--) {
        const v = a.values[i] ?? 0
        if (v !== 0) {
          latest = v
          break
        }
      }
      if (latest != null) break
    }
    return latest
  }, [operatingPl, scenario.rentAccountMatchers])

  const scenarioTotals = useMemo(() => {
    if (!operatingPl || !baseTotals || !netTotals) return null
    if (!scenario.enabled) return null
    const raw = applyBundledScenario(baseTotals, operatingPl, scenario)
    if (!raw) return null
    const nonOperatingNet = baseTotals.net.map((v, i) => (netTotals.net[i] ?? 0) - (v ?? 0))
    return { ...raw, net: raw.net.map((v, i) => v + (nonOperatingNet[i] ?? 0)) }
  }, [operatingPl, baseTotals, netTotals, scenario])

  const draftRemovalPreview = useMemo(() => {
    if (!operatingPl) return { accounts: [], totals: { revenue: 0, cogs: 0, opex: 0 } }
    const tmsAccountSet = new Set(tmsDraftAccounts ?? [])
    const consultAccountSet = new Set(consultDraftAccounts ?? [])
    const excluded = new Set(consultExcludedDraft ?? [])
    const totals = { revenue: 0, cogs: 0, opex: 0 }
    const accounts: { name: string; total: number; section: string; kind: 'tms' | 'consult' }[] = []

    for (const a of operatingPl.accounts) {
      const matchedTms = tmsAccountSet.has(a.name)
      const matchedConsult = consultAccountSet.has(a.name)
      if (!matchedTms && !matchedConsult) continue
      if (matchedConsult && excluded.has(a.name)) continue

      const kind = matchedTms ? 'tms' : 'consult'
      accounts.push({ name: a.name, total: a.total, section: a.section, kind })
      const target =
        a.section === 'trading_income' || a.section === 'other_income'
          ? 'revenue'
          : a.section === 'cost_of_sales'
            ? 'cogs'
            : 'opex'
      totals[target as 'revenue' | 'cogs' | 'opex'] += a.total ?? 0
    }
    return { accounts, totals }
  }, [operatingPl, tmsDraftAccounts, consultDraftAccounts, consultExcludedDraft])

  const doctorAccountSuggestions = useMemo(() => {
    if (!operatingPl) return []
    const tokens = normalizeTokens(scenario.legacyTmsAccountMatchers ?? [])
    if (!tokens.length) return []
    return operatingPl.accounts.filter(acc => tokenMatch(acc.name, tokens)).map(acc => acc.name)
  }, [operatingPl, scenario.legacyTmsAccountMatchers])

  const consultAccountSuggestions = useMemo(() => {
    if (!operatingPl) return []
    const tokens = normalizeTokens(scenario.legacyConsultAccountMatchers ?? [])
    if (!tokens.length) return []
    return operatingPl.accounts.filter(acc => tokenMatch(acc.name, tokens)).map(acc => acc.name)
  }, [operatingPl, scenario.legacyConsultAccountMatchers])

  const doctorRuleMap = useMemo(() => {
    const map = new Map<string, any>()
    doctorRules.forEach(rule => {
      if (rule.enabled) map.set(rule.contact_id, rule)
    })
    return map
  }, [doctorRules])

  const overrideMap = useMemo(() => {
    const map = new Map<string, any>()
    txnOverrides.forEach(o => {
      if (o.hash) map.set(o.hash, o)
    })
    return map
  }, [txnOverrides])

  const compiledDoctorPatterns = useMemo(() => {
    return (activeDoctorPatterns ?? [])
      .map(s => {
        const trimmed = String(s ?? '').trim()
        if (!trimmed) return null
        try {
          return new RegExp(trimmed, 'i')
        } catch {
          return null
        }
      })
      .filter(Boolean) as RegExp[]
  }, [activeDoctorPatterns])

  const doctorBillGroups = useMemo(() => {
    if (!gl) return []
    const bills = gl.txns.filter(txn => isApBillTxn(txn) && !isPaymentTxn(txn))
    const payments = gl.txns.filter(txn => isApBillTxn(txn) && isPaymentTxn(txn))
    const byDoctor: Record<string, any> = {}

    bills.forEach(bill => {
      const doctorLabel = inferDoctorLabel(bill) ?? 'Unknown doctor'
      const doctorContactId = normalizeContactId(doctorLabel)
      const billId = bill.reference ?? bill.description ?? `${bill.account}-${bill.date}-${bill.amount}`
      const billHash = buildTxnHash(bill)
      const override = overrideMap.get(billHash)
      const rule = doctorRuleMap.get(doctorContactId)
      const resolved = resolveTreatment({ txn: bill, override, rule })
      const relatedPayments = payments.filter(p => {
        const paymentId = p.reference ?? p.description ?? ''
        return paymentId && paymentId === billId
      })
      const paidAmount = relatedPayments.reduce((sum, p) => sum + Math.abs(p.amount ?? 0), 0)
      const billAmount = Math.abs(bill.amount ?? 0)
      const status = paidAmount === 0 ? 'unpaid' : paidAmount + 0.01 < billAmount ? 'part-paid' : 'paid'

      if (!byDoctor[doctorContactId]) {
        byDoctor[doctorContactId] = {
          doctorLabel,
          doctorContactId,
          rule,
          bills: [],
        }
      }
      byDoctor[doctorContactId].bills.push({
        bill,
        billId,
        billHash,
        override,
        resolved,
        payments: relatedPayments,
        paidAmount,
        billAmount,
        status,
      })
    })

    let groups = Object.values(byDoctor)
    if (doctorFilterEnabled && compiledDoctorPatterns.length) {
      groups = groups.filter(group => compiledDoctorPatterns.some(rx => rx.test(group.doctorLabel)))
    }

    const query = consultSearch.toLowerCase()
    const consultAccountSet = new Set(consultAccountFilters)
    const minAmount = Number(consultMin) || null
    const maxAmount = Number(consultMax) || null
    const startDate = consultStart ? new Date(consultStart) : null
    const endDate = consultEnd ? new Date(consultEnd) : null

    return groups
      .filter(group => (consultDoctorFilter.length ? consultDoctorFilter.includes(group.doctorContactId) : true))
      .map(group => {
        const filteredBills = group.bills.filter((item: any) => {
        if (consultStatusFilter !== 'all' && item.status !== consultStatusFilter) return false
        if (minAmount != null && item.billAmount < minAmount) return false
        if (maxAmount != null && item.billAmount > maxAmount) return false
        if (consultAmountSign !== 'all') {
          const amount = item.bill.amount ?? 0
          if (consultAmountSign === 'positive' && amount < 0) return false
          if (consultAmountSign === 'negative' && amount > 0) return false
        }
        if (consultAccountSet.size && !consultAccountSet.has(item.bill.account ?? '')) return false
        if (startDate && new Date(item.bill.date) < startDate) return false
        if (endDate && new Date(item.bill.date) > endDate) return false
        if (query) {
          const haystack = `${item.bill.reference ?? ''} ${item.bill.description ?? ''}`.toLowerCase()
          if (!haystack.includes(query)) return false
        }
        return true
        })
        return { ...group, bills: filteredBills }
      })
      .filter(group => group.bills.length > 0)
  }, [
    gl,
    doctorRuleMap,
    overrideMap,
    doctorFilterEnabled,
    compiledDoctorPatterns,
    consultSearch,
    consultStatusFilter,
    consultMin,
    consultMax,
    consultStart,
    consultEnd,
    consultAmountSign,
    consultDoctorFilter,
    consultAccountFilters,
  ])

  const legacyConsultGroups = useMemo(() => {
    if (!gl) return []
    const consultTokens = normalizeTokens(scenario.legacyConsultAccountMatchers ?? [])
    const consultSet = new Set(scenario.legacyConsultAccounts ?? [])
    if (!consultTokens.length && !consultSet.size) return []
    const needle = consultSearch.toLowerCase()
    const consultAccountSet = new Set(consultAccountFilters)
    const groups: Record<string, any> = {}
    for (const [idx, txn] of (gl.txns ?? []).entries()) {
      const label = `${txn.account ?? 'Unmapped'}`
      const matches =
        consultSet.size
          ? consultSet.has(label)
          : tokenMatch(label, consultTokens) || (txn.description ? tokenMatch(txn.description, consultTokens) : false)
      if (!matches) continue
      if (consultAmountSign !== 'all') {
        if (consultAmountSign === 'positive' && (txn.amount ?? 0) < 0) continue
        if (consultAmountSign === 'negative' && (txn.amount ?? 0) > 0) continue
      }
      if (consultAccountSet.size && !consultAccountSet.has(label)) continue
      if (needle) {
        const haystack = `${txn.description ?? ''} ${txn.reference ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) continue
      }
      if (!groups[label]) groups[label] = { account: label, txns: [] as any[] }
      const key = `${label}-${txn.date}-${txn.amount}-${txn.description ?? ''}-${idx}`
      groups[label].txns.push({ key, ...txn })
    }
    return Object.values(groups)
  }, [gl, scenario.legacyConsultAccountMatchers, scenario.legacyConsultAccounts, consultSearch, consultAmountSign, consultAccountFilters])

  const consultDoctorOptions = useMemo(
    () =>
      doctorBillGroups.map((group: any) => ({
        id: group.doctorContactId,
        label: group.doctorLabel,
      })),
    [doctorBillGroups]
  )

  const consultAccountOptions = useMemo(
    () => legacyConsultGroups.map((group: any) => group.account),
    [legacyConsultGroups]
  )

  const rows = operatingPl && baseTotals
    ? operatingPl.monthLabels.map((label, i) => {
        const row: any = {
          month: label,
          current: baseTotals.net[i] ?? 0,
        }
        if (scenario.enabled && scenarioTotals) row.scenario = scenarioTotals.net[i] ?? 0
        return row
      })
    : []

  const currentTotal = baseTotals ? sum(baseTotals.net) : 0
  const scenarioTotal = scenarioTotals ? sum(scenarioTotals.net) : null
  const delta = scenarioTotal == null ? 0 : scenarioTotal - currentTotal

  const chartMenuItems = useMemo(() => {
    const items = [
      {
        id: 'copy-current-total',
        label: 'Copy current total',
        onSelect: async () => {
          await navigator.clipboard.writeText(money(currentTotal))
          pushToast('Copied')
        },
      },
    ]
    if (scenarioTotal != null) {
      items.push({
        id: 'copy-scenario-total',
        label: 'Copy scenario total',
        onSelect: async () => {
          await navigator.clipboard.writeText(money(scenarioTotal))
          pushToast('Copied')
        },
      })
    }
    items.push({
      id: 'copy-change',
      label: 'Copy change',
      onSelect: async () => {
        await navigator.clipboard.writeText(money(delta))
        pushToast('Copied')
      },
    })
    return items
  }, [currentTotal, scenarioTotal, delta, pushToast])

  if (!operatingPl || !baseTotals) {
    return (
      <Card className="p-5">
        <div className="text-sm text-slate-300">
          Start by uploading a Profit &amp; Loss export. Then map accounts once, and the app becomes \"decision-grade\".
        </div>
      </Card>
    )
  }

  const best = (arr: number[]) => (arr.length ? Math.max(...arr) : 0)
  const worst = (arr: number[]) => (arr.length ? Math.min(...arr) : 0)

  const derivedProgramsRounded = derivedProgramCount != null ? Math.round(derivedProgramCount) : 0
  const effectivePrograms = scenario.machinesEnabled && derivedProgramCount != null ? derivedProgramsRounded : (scenario.programMonthlyCount ?? 0)
  const baseRentAvg = baseRentLatest ?? 0
  const programDisplayCount = scenario.machinesEnabled ? derivedProgramsRounded : (scenario.programMonthlyCount ?? 0)
  const doctorPayoutPct = Math.max(0, Math.min(100, 100 - (scenario.doctorServiceFeePct ?? 0)))
  const doctorRuleCount = doctorRules.length
  const billOverrideCount = txnOverrides.length
  const assumptionChips = [
    scenario.enabled ? 'Replacement scenario on' : null,
    scenario.includeDoctorConsultsInBundle ? 'Consult revenue removed from base' : null,
    scenario.addBundleCostsToScenario ? 'Bundle costs added to scenario COGS' : null,
    scenario.rentEnabled ? `Rent override (${scenario.rentMode === 'fixed' ? 'fixed' : 'monthly %'})` : null,
    scenario.machinesEnabled ? 'Programs derived from capacity' : 'Programs set manually',
    scenario.state ? `Clinic state: ${scenario.state}` : null,
  ].filter(Boolean) as string[]

  const buildCopyItems = (label: string, value: string, formatted?: string) =>
    createCopyMenuItems({ label, value, formatted, onCopied: () => pushToast('Copied') })

  const selectedConsultView = consultViews.find(view => view.name === consultViewName)

  const saveDoctorRule = async (contactId: string, treatment: TxnTreatment, deferral?: { startMonth?: string; months?: number; includeInOperatingKPIs?: boolean }) => {
    const payload = {
      contact_id: contactId,
      default_treatment: treatment,
      deferral_start_month: deferral?.startMonth ?? null,
      deferral_months: deferral?.months ?? null,
      deferral_include_in_operating_kpis: deferral?.includeInOperatingKPIs ?? null,
      enabled: true,
    }
    const saved = await api.upsertDoctorRule(payload)
    upsertDoctorRule(saved)
  }

  const clearDoctorRule = async (contactId: string) => {
    await api.deleteDoctorRule(contactId)
    removeDoctorRule(contactId)
  }

  const saveBillOverride = async (bill: any, treatment: TxnTreatment, deferral?: { startMonth?: string; months?: number; includeInOperatingKPIs?: boolean }) => {
    const hash = buildTxnHash(bill)
    const payload = {
      source: 'XERO_GL',
      document_id: bill.reference ?? hash,
      line_item_id: null,
      hash,
      treatment,
      deferral_start_month: deferral?.startMonth ?? null,
      deferral_months: deferral?.months ?? null,
      deferral_include_in_operating_kpis: deferral?.includeInOperatingKPIs ?? null,
    }
    const saved = await api.upsertTxnOverride(payload)
    upsertTxnOverride(saved)
  }

  const clearBillOverride = async (overrideId: string) => {
    await api.deleteTxnOverride(overrideId)
    removeTxnOverride(overrideId)
  }

  const saveDoctorPatterns = async () => {
    const lines = doctorPatternDraft
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    const errors: string[] = []
    lines.forEach((line, idx) => {
      try {
        new RegExp(line, 'i')
      } catch {
        errors.push(`Line ${idx + 1}: invalid regex`)
      }
    })
    setDoctorPatternErrors(errors)
    if (errors.length) return
    await api.upsertPreference('doctor_patterns_v1', { value_json: { patterns: lines } })
    setDoctorPatterns(lines)
  }

  const resetDoctorPatterns = async () => {
    await api.upsertPreference('doctor_patterns_v1', { value_json: { patterns: DEFAULT_DOCTOR_PATTERNS } })
    setDoctorPatterns(DEFAULT_DOCTOR_PATTERNS)
    setDoctorPatternDraft(DEFAULT_DOCTOR_PATTERNS.join('\n'))
    setDoctorPatternErrors([])
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        <PageHeader
          title="Strategic Overview"
          subtitle="If we ran the business this way instead of the current way, what would actually change — and is it worth it?"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setStatusDrawerOpen(true)}>
                Details
              </Button>
              {scenario.enabled ? (
                <Chip tone={delta >= 0 ? 'good' : 'bad'} className="shrink-0">
                  Change {money(delta)}
                </Chip>
              ) : (
                <Chip className="shrink-0">Scenario off</Chip>
              )}
            </>
          }
        />

        <Card className="p-5">

        <div className="text-sm font-semibold text-slate-100">Current vs scenario</div>
        <div className="text-xs text-slate-400 mt-1">Snapshot KPIs + interactive monthly trend.</div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('Current 12-mo profit', currentTotal.toString(), money(currentTotal)),
                title: 'Current 12-mo profit',
              })
            }
          >
            <div className="text-xs text-slate-300">Current 12-mo profit</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">{money(currentTotal)}</div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="Current 12-mo profit" value={currentTotal.toString()} formatted={money(currentTotal)} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('Scenario 12-mo profit', (scenarioTotal ?? 0).toString(), scenarioTotal == null ? '0' : money(scenarioTotal)),
                title: 'Scenario 12-mo profit',
              })
            }
          >
            <div className="text-xs text-slate-300">Scenario 12-mo profit</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {scenarioTotal == null ? '-' : money(scenarioTotal)}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="Scenario 12-mo profit" value={(scenarioTotal ?? 0).toString()} formatted={scenarioTotal == null ? '0' : money(scenarioTotal)} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('Avg monthly profit (current)', avg(baseTotals.net).toString(), money(avg(baseTotals.net))),
                title: 'Avg monthly profit (current)',
              })
            }
          >
            <div className="text-xs text-slate-300">Avg monthly profit (current)</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">{money(avg(baseTotals.net))}</div>
            <div className="absolute right-2 top-2">
              <CopyAffordance label="Avg monthly profit (current)" value={avg(baseTotals.net).toString()} formatted={money(avg(baseTotals.net))} />
            </div>
          </div>
          <div
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4"
            onContextMenu={(event) =>
              openMenu({
                event,
                items: buildCopyItems('Best / worst (current)', `${best(baseTotals.net)} / ${worst(baseTotals.net)}`, `${money(best(baseTotals.net))} / ${money(worst(baseTotals.net))}`),
                title: 'Best / worst (current)',
              })
            }
          >
            <div className="text-xs text-slate-300">Best / worst (current)</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {money(best(baseTotals.net))} / {money(worst(baseTotals.net))}
            </div>
            <div className="absolute right-2 top-2">
              <CopyAffordance
                label="Best / worst (current)"
                value={`${best(baseTotals.net)} / ${worst(baseTotals.net)}`}
                formatted={`${money(best(baseTotals.net))} / ${money(worst(baseTotals.net))}`}
              />
            </div>
          </div>
        </div>

        <div
          className="mt-4 h-[300px]"
          onContextMenu={(event) =>
            openMenu({
              event,
              items: chartMenuItems,
              title: 'Chart metrics',
            })
          }
        >
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span>P&amp;L trend (current vs scenario)</span>
            <span>Change shown as scenario minus current</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'rgba(226,232,240,0.7)', fontSize: 12 }} width={70} />
              {/* Key forces a clean remount so disabled series never lingers in hover state */}
              <Tooltip
                key={scenario.enabled ? 'scenario-on' : 'scenario-off'}
                content={<OverviewTooltip showScenario={scenario.enabled && !!scenarioTotals} />}
              />
              <Line type="monotone" name="Current" dataKey="current" dot={false} strokeWidth={2} stroke="#38bdf8" />
              {scenario.enabled && (
                <Line type="monotone" name="Scenario" dataKey="scenario" dot={false} strokeWidth={2} stroke="#22c55e" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-100">Levers</div>
            <div className="text-xs text-slate-400 mt-1">Change a few key inputs, review impact, then apply.</div>
          </div>
          <Chip className="shrink-0">Scenario controls</Chip>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-indigo-400/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-indigo-900/40 p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Shifting the needle</div>
                <div className="text-xs text-slate-300 mt-1">
                  High-leverage levers that can swing profitability (without changing clinical volume).
                </div>
              </div>
              <Chip className="shrink-0">High leverage</Chip>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Rent</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Current rent is read from the uploaded P&amp;L (matched accounts). Scenario can override it.
                    </div>
                  </div>
                  <ToggleSwitch checked={scenario.rentEnabled} onChange={(v) => setScenario({ rentEnabled: v })} />
                </div>

                {scenario.rentEnabled ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Matched rent accounts</Label>
                      <textarea
                        className="mt-2 h-20 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                        value={(scenario.rentAccountMatchers ?? []).join('\n')}
                        onChange={(e) => setScenario({ rentAccountMatchers: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })}
                      />
                      <div className="mt-1 text-xs text-slate-300">
                        Avg matched rent (current): <span className="font-semibold text-slate-100">{money(baseRentAvg)}</span> / month
                      </div>
                    </div>
                    <div>
                      <Label>Mode</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setScenario({ rentMode: 'fixed' })}
                          className={
                            'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                            (scenario.rentMode === 'fixed'
                              ? 'border-white/20 bg-white/10 text-slate-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                          }
                        >
                          Fixed monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setScenario({ rentMode: 'percent' })}
                          className={
                            'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                            (scenario.rentMode === 'percent'
                              ? 'border-white/20 bg-white/10 text-slate-100'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                          }
                        >
                          Monthly % change
                        </button>
                      </div>

                      {scenario.rentMode === 'fixed' ? (
                        <div className="mt-3">
                          <Label>Scenario rent (per month)</Label>
                          <Input className="mt-2" type="number" value={scenario.rentFixedMonthly} onChange={(e) => setScenario({ rentFixedMonthly: toNum(e.target.value) })} />
                          <div className="mt-1 text-xs text-slate-300">
                            This replaces matched rent each month (scenario only).
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <Label>Monthly change (%)</Label>
                          <Input
                            className="mt-2"
                            type="number"
                            value={scenario.rentPercentPerMonth}
                            onChange={(e) => setScenario({ rentPercentPerMonth: toNum(e.target.value) })}
                          />
                          <div className="mt-1 text-xs text-slate-300">
                            Compounded month-to-month (as displayed left to right in the chart).
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-300">Off = scenario keeps rent exactly as reported in the uploaded P&amp;L.</div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">TMS machine capacity</div>
                    <div className="text-xs text-slate-300 mt-1">
                      Derive programs/month from machines, utilisation, and a conservative 4.33 weeks/month. Or override manually.
                    </div>
                  </div>
                  <Chip tone={scenario.machinesEnabled ? 'good' : 'bad'} className="shrink-0">
                    {scenario.machinesEnabled ? 'Dynamic' : 'Manual override'}
                  </Chip>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setScenario({ machinesEnabled: true })}
                    className={
                      'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                      (scenario.machinesEnabled
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                    }
                  >
                    Dynamic (auto-adjust)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setScenario({
                        machinesEnabled: false,
                        programMonthlyCount: programDisplayCount || derivedProgramsRounded,
                      })
                    }
                    className={
                      'rounded-xl border px-3 py-2 text-xs font-semibold ' +
                      (!scenario.machinesEnabled
                        ? 'border-amber-400/40 bg-amber-400/10 text-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')
                    }
                  >
                    Manual override
                  </button>
                </div>

                {scenario.machinesEnabled ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label>Machines</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={scenario.tmsMachines}
                          onChange={(e) => setScenario({ tmsMachines: toNum(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Patients / week / machine</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={scenario.patientsPerMachinePerWeek}
                          onChange={(e) => setScenario({ patientsPerMachinePerWeek: toNum(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Utilisation (%)</Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={Math.round((scenario.utilisation ?? 0) * 100)}
                          onChange={(e) => setScenario({ utilisation: Math.min(1, Math.max(0, toNum(e.target.value) / 100)) })}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-xs text-slate-100">
                      Programs / month (auto): <span className="text-base font-semibold text-white">{derivedProgramsRounded}</span>
                      <div className="text-emerald-100/70">
                        Used throughout the scenario (consult payouts, program revenue, and COGS).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Label>Programs / month (manual)</Label>
                    <Input
                      className="mt-2"
                      type="number"
                      value={scenario.programMonthlyCount}
                      onChange={(e) => setScenario({ programMonthlyCount: toNum(e.target.value) })}
                    />
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                      Manual override is active. Auto capacity adjustments are paused until you switch back to Dynamic.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Bundled pricing scenario</div>
                <div className="text-xs text-slate-300 mt-1">
                  Replacement-based: remove legacy TMS (and optionally consult revenue), then add CBA + cgTMS bundle revenue. Costs are optional and explicit.
                </div>
              </div>
              <ToggleSwitch checked={scenario.enabled} onChange={(v) => setScenario({ enabled: v })} label="Enable" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Clinic state (sets MRI defaults)</Label>
                <select
                  value={scenario.state}
                  onChange={(e) => {
                    const st = e.target.value as any
                    const mriActual = mriDefaultForState(st, defaults)
                    const mriPatient = mriPatientForState(st, defaults)
                    setScenario({
                      state: st,
                      cbaMriCost: mriActual,
                      progMriCost: mriActual,
                      cbaMriPatientFee: mriPatient,
                      progMriPatientFee: mriPatient,
                      cbaPrice: suggestedCbaPrice(st, defaults),
                      programPrice: suggestedProgramPrice(st, defaults),
                    })
                  }}
                  className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="NSW/QLD">NSW / QLD</option>
                  <option value="WA">WA</option>
                  <option value="VIC">VIC</option>
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Cost treatment</div>
                    <div className="text-xs text-slate-300 mt-1">
                      If ON, we add per-patient bundle costs into scenario COGS (conservative). If OFF, the scenario changes revenue only and assumes costs already exist in the P&amp;L.
                    </div>
                  </div>
                  <ToggleSwitch checked={scenario.addBundleCostsToScenario} onChange={(v) => setScenario({ addBundleCostsToScenario: v })} />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Doctor &amp; Consult Setup</div>
                  <div className="text-xs text-slate-300 mt-1">
                    No default selections are applied. Suggestions are opt-in, previewed, and reversible.
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTmsDraftAccounts([])
                    setConsultDraftAccounts([])
                    setConsultExcludedDraft([])
                    setDoctorAccountSuggestionsAccepted(false)
                    setConsultAccountSuggestionsAccepted(false)
                    setScenario({
                      legacyTmsAccounts: [],
                      legacyConsultAccounts: [],
                      excludedConsultAccounts: [],
                      includeDoctorConsultsInBundle: false,
                    })
                    pushToast('Selections reset.')
                  }}
                >
                  Reset to none
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                {([
                  { id: 1, title: 'Doctor revenue', detail: 'TMS treatment accounts' },
                  { id: 2, title: 'Consult revenue', detail: 'Non-TMS consults' },
                  { id: 3, title: 'Review impact', detail: 'Preview removals' },
                  { id: 4, title: 'Apply scenario', detail: 'Commit changes' },
                ] as const).map(step => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSetupStep(step.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                      setupStep === step.id ? 'border-indigo-400/40 bg-indigo-500/15 text-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div>Step {step.id}</div>
                    <div className="text-[11px] text-slate-300">{step.title}</div>
                    <div className="text-[10px] text-slate-500">{step.detail}</div>
                  </button>
                ))}
              </div>

              {setupStep === 1 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Select doctor (TMS treatment) revenue accounts</div>
                      <div className="text-xs text-slate-300 mt-1">
                        Choose the revenue accounts that represent doctor/TMS treatment revenue. Suggested matches are optional and can be refined later.
                      </div>
                    </div>
                    <Chip>{tmsDraftAccounts.length} selected</Chip>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <Button variant="secondary" size="sm" onClick={() => setDoctorSelectorOpen(true)}>
                      Open selector
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!doctorAccountSuggestions.length || doctorAccountSuggestionsAccepted}
                      onClick={() => {
                        setTmsDraftAccounts(prev => Array.from(new Set([...prev, ...doctorAccountSuggestions])))
                        setDoctorAccountSuggestionsAccepted(true)
                      }}
                    >
                      Accept all suggestions
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {doctorAccountSuggestions.length === 0 ? (
                      <span>No suggestions yet.</span>
                    ) : (
                      doctorAccountSuggestions.map(acc => (
                        <button
                          key={`doctor-suggest-${acc}`}
                          type="button"
                          onClick={() => setTmsDraftAccounts(prev => (prev.includes(acc) ? prev : [...prev, acc]))}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                        >
                          Suggested · {acc}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {setupStep === 2 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Select consult (non-TMS) revenue accounts</div>
                      <div className="text-xs text-slate-300 mt-1">
                        Choose consult-only revenue accounts. You can also exclude consults that should remain in the base P&amp;L.
                      </div>
                    </div>
                    <Chip>{consultDraftAccounts.length} selected</Chip>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <Button variant="secondary" size="sm" onClick={() => setConsultSelectorOpen(true)}>
                      Open selector
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!consultAccountSuggestions.length || consultAccountSuggestionsAccepted}
                      onClick={() => {
                        setConsultDraftAccounts(prev => Array.from(new Set([...prev, ...consultAccountSuggestions])))
                        setConsultAccountSuggestionsAccepted(true)
                      }}
                    >
                      Accept all suggestions
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {consultAccountSuggestions.length === 0 ? (
                      <span>No suggestions yet.</span>
                    ) : (
                      consultAccountSuggestions.map(acc => (
                        <button
                          key={`consult-suggest-${acc}`}
                          type="button"
                          onClick={() => setConsultDraftAccounts(prev => (prev.includes(acc) ? prev : [...prev, acc]))}
                          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                        >
                          Suggested · {acc}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {setupStep === 3 && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="text-xs font-semibold text-slate-100">Review impact</div>
                    <div className="text-xs text-slate-300 mt-1">Accounts removed: {draftRemovalPreview.accounts.length}</div>
                    <div className="mt-2 text-[11px] text-slate-300 space-y-1 max-h-32 overflow-auto pr-1">
                      {draftRemovalPreview.accounts.length === 0 ? (
                        <div className="text-slate-400">No accounts selected for removal.</div>
                      ) : (
                        draftRemovalPreview.accounts.map(acc => (
                          <div key={acc.name} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                            <span className="font-semibold text-slate-100">{acc.name}</span>
                            <span className="text-slate-400 uppercase text-[10px]">{acc.kind}</span>
                            <span className="text-slate-200">{money(acc.total)}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Totals removed: Revenue <span className="text-slate-200">{money(draftRemovalPreview.totals.revenue)}</span>, COGS{' '}
                      <span className="text-slate-200">{money(draftRemovalPreview.totals.cogs)}</span>, OpEx{' '}
                      <span className="text-slate-200">{money(draftRemovalPreview.totals.opex)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Months affected: <span className="text-slate-200">{operatingPl?.monthLabels.length ?? 0}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-100">Capacity &amp; payout model</div>
                    <div className="text-[11px] text-slate-300">
                      Programs / month: <span className="font-semibold text-slate-100">{programDisplayCount}</span> ({scenario.machinesEnabled ? 'capacity-derived' : 'manual'}).
                      Capacity inputs: {scenario.tmsMachines} machines, {scenario.patientsPerMachinePerWeek} patients per week, utilisation {Math.round((scenario.utilisation ?? 0) * 100)}%.
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Doctor payout: clinic retains {scenario.doctorServiceFeePct}% service fee, doctor payout {doctorPayoutPct}% of patient fee.
                    </div>
                    <button
                      type="button"
                      onClick={() => setConsultModalOpen(true)}
                      className="mt-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-indigo-500/15"
                    >
                      Review consult transactions
                    </button>
                  </div>
                </div>
              )}

              {setupStep === 4 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-100">Apply to scenario</div>
                  <div className="text-xs text-slate-300">
                    Confirm and apply the staged doctor/consult selections to the active scenario. You can revisit any step to adjust.
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setScenario({
                        legacyTmsAccounts: tmsDraftAccounts,
                        legacyConsultAccounts: consultDraftAccounts,
                        excludedConsultAccounts: consultExcludedDraft,
                        includeDoctorConsultsInBundle: consultDraftAccounts.length > 0,
                      })
                      pushToast('Scenario updated.')
                    }}
                  >
                    Apply to scenario
                  </Button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {doctorSelectorOpen && (
                <motion.div
                  className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDoctorSelectorOpen(false)}
                >
                  <motion.div
                    className="h-full w-full max-w-lg bg-slate-950 border-l border-white/10 p-5 flex flex-col"
                    initial={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-100">Select doctor (TMS) revenue accounts</div>
                      <Button variant="ghost" size="sm" onClick={() => setDoctorSelectorOpen(false)}>Done</Button>
                    </div>
                    <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Label>Account filter</Label>
                        {(['revenue', 'cogs', 'opex', 'all'] as const).map(filter => (
                          <Chip
                            key={filter}
                            className={`cursor-pointer ${tmsAccountFilter === filter ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                            onClick={() => setTmsAccountFilter(filter)}
                          >
                            {filter === 'all' ? 'All' : filter.toUpperCase()}
                          </Chip>
                        ))}
                        <Input
                          className="w-56"
                          value={tmsAccountSearch}
                          onChange={(e) => setTmsAccountSearch(e.target.value)}
                          placeholder="Search accounts"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>Suggested</span>
                        {doctorAccountSuggestions.map(acc => (
                          <button
                            key={`doctor-suggest-drawer-${acc}`}
                            type="button"
                            onClick={() => setTmsDraftAccounts(prev => (prev.includes(acc) ? prev : [...prev, acc]))}
                            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                          >
                            Suggested · {acc}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2 space-y-2">
                        {filteredTmsAccounts.map(acc => (
                          <label key={acc.name} className="flex items-center gap-2 text-xs text-slate-200">
                            <input
                              type="checkbox"
                              checked={tmsDraftAccounts.includes(acc.name)}
                              onChange={() =>
                                setTmsDraftAccounts(prev =>
                                  prev.includes(acc.name) ? prev.filter(a => a !== acc.name) : [...prev, acc.name]
                                )
                              }
                            />
                            <span className="flex-1">{acc.name}</span>
                            <span className="text-slate-400">{SECTION_LABEL[acc.section]}</span>
                          </label>
                        ))}
                        {filteredTmsAccounts.length === 0 && <div className="text-xs text-slate-400">No accounts match this filter.</div>}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <Button variant="ghost" size="sm" onClick={() => setTmsDraftAccounts([])}>
                          Reset to none
                        </Button>
                        <div>{tmsDraftAccounts.length} selected</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {consultSelectorOpen && (
                <motion.div
                  className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConsultSelectorOpen(false)}
                >
                  <motion.div
                    className="h-full w-full max-w-lg bg-slate-950 border-l border-white/10 p-5 flex flex-col"
                    initial={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-100">Select consult (non-TMS) revenue accounts</div>
                      <Button variant="ghost" size="sm" onClick={() => setConsultSelectorOpen(false)}>Done</Button>
                    </div>
                    <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Label>Account filter</Label>
                        {(['revenue', 'cogs', 'opex', 'all'] as const).map(filter => (
                          <Chip
                            key={filter}
                            className={`cursor-pointer ${consultAccountFilter === filter ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                            onClick={() => setConsultAccountFilter(filter)}
                          >
                            {filter === 'all' ? 'All' : filter.toUpperCase()}
                          </Chip>
                        ))}
                        <Input
                          className="w-56"
                          value={consultAccountSearch}
                          onChange={(e) => setConsultAccountSearch(e.target.value)}
                          placeholder="Search accounts"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>Suggested</span>
                        {consultAccountSuggestions.map(acc => (
                          <button
                            key={`consult-suggest-drawer-${acc}`}
                            type="button"
                            onClick={() => setConsultDraftAccounts(prev => (prev.includes(acc) ? prev : [...prev, acc]))}
                            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                          >
                            Suggested · {acc}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2 space-y-2">
                        {filteredConsultAccounts.map(acc => (
                          <label key={acc.name} className="flex items-center gap-2 text-xs text-slate-200">
                            <input
                              type="checkbox"
                              checked={consultDraftAccounts.includes(acc.name)}
                              onChange={() =>
                                setConsultDraftAccounts(prev =>
                                  prev.includes(acc.name) ? prev.filter(a => a !== acc.name) : [...prev, acc.name]
                                )
                              }
                            />
                            <span className="flex-1">{acc.name}</span>
                            <span className="text-slate-400">{SECTION_LABEL[acc.section]}</span>
                          </label>
                        ))}
                        {filteredConsultAccounts.length === 0 && <div className="text-xs text-slate-400">No accounts match this filter.</div>}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-semibold text-slate-100">Exclude accounts</div>
                        <div className="mt-2 space-y-2 text-xs text-slate-200">
                          {filteredConsultAccounts.map(acc => (
                            <label key={`exclude-${acc.name}`} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={consultExcludedDraft.includes(acc.name)}
                                onChange={() =>
                                  setConsultExcludedDraft(prev =>
                                    prev.includes(acc.name) ? prev.filter(a => a !== acc.name) : [...prev, acc.name]
                                  )
                                }
                              />
                              <span className="flex-1">{acc.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConsultExcludedDraft(Array.from(new Set([...consultDraftAccounts])))}
                          >
                            Exclude selected
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConsultExcludedDraft([])}>
                            Clear exclusions
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setConsultDraftAccounts([]); setConsultExcludedDraft([]) }}>
                            Reset to none
                          </Button>
                        </div>
                        <div>{consultDraftAccounts.length} selected · {consultExcludedDraft.length} excluded</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bundle streams */}
            {(() => {
              const mriDefault = mriDefaultForState(scenario.state, defaults)
              const svcFactor = 1 - Math.min(1, Math.max(0, (scenario.doctorServiceFeePct ?? 0) / 100))
              const cbaConsultActual = (scenario.cbaInitialConsultFee ?? 0) * svcFactor * (scenario.cbaInitialConsultCount ?? 0)
              const cbaIncluded =
                (scenario.cbaIncludeMRI ? (scenario.cbaMriCost ?? mriDefault) : 0) +
                (scenario.cbaIncludeQuicktome ? (scenario.cbaQuicktomeCost ?? 0) : 0) +
                (scenario.cbaIncludeCreyos ? (scenario.cbaCreyosCost ?? 0) : 0) +
                (scenario.cbaIncludeInitialConsult ? cbaConsultActual : 0) +
                (scenario.cbaOtherCogsPerAssessment ?? 0)

              const wkActual = (scenario.prog6WkConsultFee ?? 0) * svcFactor * (scenario.prog6WkConsultCount ?? 0)
              const moActual = wkActual // 6-month follow-up mirrors 6-week count + fee
              const progIncluded =
                (scenario.progIncludePostMRI ? (scenario.progMriCost ?? mriDefault) : 0) +
                (scenario.progIncludeQuicktome ? (scenario.progQuicktomeCost ?? 0) : 0) +
                (scenario.progInclude6WkConsult ? wkActual : 0) +
                (scenario.progInclude6WkConsult ? moActual : 0) +
                (scenario.progIncludeAdjunctAllowance ? (scenario.progAdjunctAllowance ?? 0) : 0) +
                (scenario.progTreatmentDeliveryCost ?? 0) +
                (scenario.progOtherCogsPerProgram ?? 0)

              const cbaApplied = scenario.addBundleCostsToScenario ? cbaIncluded : 0
              const progApplied = scenario.addBundleCostsToScenario ? progIncluded : 0

              return (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">CBA bundle</div>
                        <div className="text-xs text-slate-300 mt-1">Pre-treatment work-up to cover assessment costs (even if they don’t proceed).</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const st = scenario.state
                          const mri = mriDefaultForState(st, defaults)
                          setScenario({
                            cbaPrice: suggestedCbaPrice(st, defaults),
                            cbaIncludeMRI: true,
                            cbaMriCost: mri,
                            cbaMriPatientFee: mriPatientForState(st, defaults),
                            cbaIncludeQuicktome: true,
                            cbaQuicktomeCost: 200,
                            cbaQuicktomePatientFee: 200,
                            cbaIncludeCreyos: true,
                            cbaCreyosCost: 75,
                            cbaCreyosPatientFee: 75,
                            cbaIncludeInitialConsult: true,
                            cbaInitialConsultFee: 650,
                            cbaInitialConsultCount: 1,
                          })
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Use framework defaults
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label>CBA assessments / month</Label>
                        <Input className="mt-2" type="number" value={scenario.cbaMonthlyCount} onChange={(e) => setScenario({ cbaMonthlyCount: toNum(e.target.value) })} />
                      </div>
                      <div>
                        <Label>CBA price (revenue)</Label>
                        <Input className="mt-2" type="number" value={scenario.cbaPrice} onChange={(e) => setScenario({ cbaPrice: toNum(e.target.value) })} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CostItem
                        title="MRI"
                        subtitle="Radiology"
                        checked={scenario.cbaIncludeMRI}
                        onChecked={(v) => setScenario({ cbaIncludeMRI: v })}
                        patientFee={scenario.cbaMriPatientFee}
                        onPatientFee={(n) => setScenario({ cbaMriPatientFee: n })}
                        actual={scenario.cbaMriCost}
                        onActual={(n) => setScenario({ cbaMriCost: n })}
                      />
                      <CostItem
                        title="Quicktome"
                        subtitle="Processing"
                        checked={scenario.cbaIncludeQuicktome}
                        onChecked={(v) => setScenario({ cbaIncludeQuicktome: v })}
                        patientFee={scenario.cbaQuicktomePatientFee}
                        onPatientFee={(n) => setScenario({ cbaQuicktomePatientFee: n })}
                        actual={scenario.cbaQuicktomeCost}
                        onActual={(n) => setScenario({ cbaQuicktomeCost: n })}
                      />
                      <CostItem
                        title="Creyos"
                        subtitle="Assessment"
                        checked={scenario.cbaIncludeCreyos}
                        onChecked={(v) => setScenario({ cbaIncludeCreyos: v })}
                        patientFee={scenario.cbaCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ cbaCreyosPatientFee: n })}
                        actual={scenario.cbaCreyosCost}
                        onActual={(n) => setScenario({ cbaCreyosCost: n })}
                      />
                      <ConsultCostItem
                        title="Initial consult"
                        subtitle="Doctor"
                        checked={scenario.cbaIncludeInitialConsult}
                        onChecked={(v) => setScenario({ cbaIncludeInitialConsult: v })}
                        count={scenario.cbaInitialConsultCount}
                        onCount={(n) => setScenario({ cbaInitialConsultCount: n })}
                        patientFee={scenario.cbaInitialConsultFee}
                        onPatientFee={(n) => setScenario({ cbaInitialConsultFee: n })}
                        patientCount={scenario.cbaMonthlyCount ?? 0}
                        patientLabel="CBA / month"
                      />
                      <CostItem
                        title="Other assessment COGS"
                        subtitle="Optional"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.cbaOtherCogsPerAssessment}
                        onActual={(n) => setScenario({ cbaOtherCogsPerAssessment: n })}
                        showPatientFee={false}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-slate-300">
                        Included costs / CBA: <span className="font-semibold text-slate-100">{money(cbaIncluded)}</span>
                        <span className="text-slate-400"> applied to scenario: {scenario.addBundleCostsToScenario ? 'yes' : 'no'}</span>
                      </div>
                      <div className="text-slate-300">
                        Gross margin / CBA: <span className="font-semibold text-slate-100">{money((scenario.cbaPrice ?? 0) - cbaIncluded)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">cgTMS bundle</div>
                        <div className="text-xs text-slate-300 mt-1">Treatment + (optional) therapies + follow-ups.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const st = scenario.state
                          const mri = mriDefaultForState(st, defaults)
                          setScenario({
                            programPrice: suggestedProgramPrice(st, defaults),
                            progIncludePostMRI: true,
                            progMriCost: mri,
                            progMriPatientFee: mriPatientForState(st, defaults),
                            progIncludeQuicktome: true,
                            progQuicktomeCost: 200,
                            progQuicktomePatientFee: 200,
                            progIncludeCreyos: true,
                            progCreyosCost: 75,
                            progCreyosPatientFee: 75,
                            progInclude6WkConsult: true,
                            prog6WkConsultFee: 450,
                            prog6WkConsultCount: 1,
                            progIncludeAdjunctAllowance: true,
                            progAdjunctAllowance: 560,
                            progInclude6MoConsult: true,
                            prog6MoConsultFee: 450,
                            prog6MoConsultCount: 1,
                            progInclude6MoCreyos: true,
                            prog6MoCreyosCost: 75,
                            prog6MoCreyosPatientFee: 75,
                          })
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Use framework defaults
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="flex items-center justify-between gap-2">
                          Programs / month
                          <Chip tone={scenario.machinesEnabled ? 'good' : 'bad'} className="h-6 px-2">
                            {scenario.machinesEnabled ? 'Auto' : 'Manual'}
                          </Chip>
                        </Label>
                        <Input
                          className="mt-2"
                          type="number"
                          value={programDisplayCount}
                          onChange={(e) => setScenario({ programMonthlyCount: toNum(e.target.value) })}
                          disabled={scenario.machinesEnabled}
                        />
                        <div className="mt-1 text-xs text-slate-300">
                          {scenario.machinesEnabled && derivedProgramCount != null ? (
                            <>
                              Derived from capacity:{' '}
                              <span className="font-semibold text-slate-100">{derivedProgramsRounded}</span> programs / month (set above).
                            </>
                          ) : (
                            'Manual override in use. Switch to Dynamic above to auto-adjust.'
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>cgTMS price (revenue)</Label>
                        <Input className="mt-2" type="number" value={scenario.programPrice} onChange={(e) => setScenario({ programPrice: toNum(e.target.value) })} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CostItem
                        title="Post MRI"
                        subtitle="Radiology"
                        checked={scenario.progIncludePostMRI}
                        onChecked={(v) => setScenario({ progIncludePostMRI: v })}
                        patientFee={scenario.progMriPatientFee}
                        onPatientFee={(n) => setScenario({ progMriPatientFee: n })}
                        actual={scenario.progMriCost}
                        onActual={(n) => setScenario({ progMriCost: n })}
                      />
                      <CostItem
                        title="Quicktome"
                        subtitle="Processing"
                        checked={scenario.progIncludeQuicktome}
                        onChecked={(v) => setScenario({ progIncludeQuicktome: v })}
                        patientFee={scenario.progQuicktomePatientFee}
                        onPatientFee={(n) => setScenario({ progQuicktomePatientFee: n })}
                        actual={scenario.progQuicktomeCost}
                        onActual={(n) => setScenario({ progQuicktomeCost: n })}
                      />
                      <CostItem
                        title="Creyos"
                        subtitle="Assessment"
                        checked={scenario.progIncludeCreyos}
                        onChecked={(v) => setScenario({ progIncludeCreyos: v })}
                        patientFee={scenario.progCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ progCreyosPatientFee: n })}
                        actual={scenario.progCreyosCost}
                        onActual={(n) => setScenario({ progCreyosCost: n })}
                      />
                      <ConsultCostItem
                        title="6-week consult"
                        subtitle="Doctor"
                        checked={scenario.progInclude6WkConsult}
                        onChecked={(v) => setScenario({ progInclude6WkConsult: v })}
                        count={scenario.prog6WkConsultCount}
                        onCount={(n) => setScenario({ prog6WkConsultCount: n })}
                        patientFee={scenario.prog6WkConsultFee}
                        onPatientFee={(n) => setScenario({ prog6WkConsultFee: n })}
                        patientCount={effectivePrograms}
                        patientLabel="Programs / month"
                      />
                      <CostItem
                        title="Adjunct allowance"
                        subtitle="Therapies"
                        checked={scenario.progIncludeAdjunctAllowance}
                        onChecked={(v) => setScenario({ progIncludeAdjunctAllowance: v })}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progAdjunctAllowance}
                        onActual={(n) => setScenario({ progAdjunctAllowance: n })}
                        showPatientFee={false}
                      />
                      <ConsultCostItem
                        title="6-month consult"
                        subtitle="Doctor"
                        checked={scenario.progInclude6MoConsult}
                        onChecked={(v) => setScenario({ progInclude6MoConsult: v })}
                        count={scenario.prog6MoConsultCount}
                        onCount={(n) => setScenario({ prog6MoConsultCount: n })}
                        patientFee={scenario.prog6MoConsultFee}
                        onPatientFee={(n) => setScenario({ prog6MoConsultFee: n })}
                        patientCount={effectivePrograms}
                        patientLabel="Programs / month"
                      />
                      <CostItem
                        title="6-month Creyos"
                        subtitle="Assessment"
                        checked={scenario.progInclude6MoCreyos}
                        onChecked={(v) => setScenario({ progInclude6MoCreyos: v })}
                        patientFee={scenario.prog6MoCreyosPatientFee}
                        onPatientFee={(n) => setScenario({ prog6MoCreyosPatientFee: n })}
                        actual={scenario.prog6MoCreyosCost}
                        onActual={(n) => setScenario({ prog6MoCreyosCost: n })}
                      />
                      <CostItem
                        title="Treatment delivery"
                        subtitle="Unmodelled cost"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progTreatmentDeliveryCost}
                        onActual={(n) => setScenario({ progTreatmentDeliveryCost: n })}
                        showPatientFee={false}
                      />
                      <CostItem
                        title="Other program COGS"
                        subtitle="Optional"
                        checked={true}
                        onChecked={() => {}}
                        toggleable={false}
                        patientFee={0}
                        onPatientFee={() => {}}
                        actual={scenario.progOtherCogsPerProgram}
                        onActual={(n) => setScenario({ progOtherCogsPerProgram: n })}
                        showPatientFee={false}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="text-slate-300">
                        Included costs / program: <span className="font-semibold text-slate-100">{money(progIncluded)}</span>
                        <span className="text-slate-400"> applied to scenario: {scenario.addBundleCostsToScenario ? 'yes' : 'no'}</span>
                      </div>
                      <div className="text-slate-300">
                        Gross margin / program: <span className="font-semibold text-slate-100">{money((scenario.programPrice ?? 0) - progIncluded)}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                      Scenario calculation (monthly):
                      <div className="mt-1 text-slate-200">
                        Revenue change = CBA times {money(scenario.cbaPrice ?? 0)} plus Program times {money(scenario.programPrice ?? 0)}
                      </div>
                      <div className="text-slate-200">
                        COGS change = {scenario.addBundleCostsToScenario ? `CBA times ${money(cbaApplied)} plus Program times ${money(progApplied)}` : '0 (costs assumed already in P&L)'}
                      </div>
                      <div className="text-slate-200">
                        Bundle cost impact: CBA {moneyShort(cbaApplied)} per month and Program {moneyShort(progApplied)} per month (applied when toggle is ON).
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
            <div className="mt-4 text-xs text-slate-400">
              Next iteration: plug scenario revenue into the Dream lines (so you can drill down into assumptions the same way it drills into GL).
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Assumptions used:</span>
              {assumptionChips.length === 0 ? (
                <span className="text-xs text-slate-400">None (scenario off)</span>
              ) : (
                assumptionChips.map(chip => (
                  <span key={chip} className="text-xs font-semibold text-slate-100 rounded-full bg-white/5 border border-white/10 px-3 py-1">
                    {chip}
                  </span>
                ))
              )}
            </div>
          </div>
      </Card>
    </div>

    <AnimatePresence>
      {statusDrawerOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setStatusDrawerOpen(false)}
        >
          <motion.div
            className="h-full w-full max-w-md bg-slate-950 border-l border-white/10 p-5"
            initial={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: prefersReducedMotion ? 0 : 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Overview details</div>
              <Button variant="ghost" size="sm" onClick={() => setStatusDrawerOpen(false)}>Close</Button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-100">Data status</div>
                <div className="text-xs text-slate-300">
                  P&amp;L: {pl ? <span className="text-emerald-200 font-semibold">Loaded</span> : <span className="text-rose-200 font-semibold">Missing</span>}
                  {plLoadedAt ? <span className="text-slate-400"> updated {new Date(plLoadedAt).toLocaleString()}</span> : null}
                </div>
                <div className="text-xs text-slate-300">
                  GL: {gl ? <span className="text-emerald-200 font-semibold">Loaded</span> : <span className="text-amber-200 font-semibold">Optional</span>}
                  {glLoadedAt ? <span className="text-slate-400"> updated {new Date(glLoadedAt).toLocaleString()}</span> : null}
                </div>
                <div className="text-xs text-slate-400">Scenario requires P&amp;L; GL unlocks consult previews and drill-down.</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-100">Scenario setup</div>
                <div className="text-xs text-slate-300">Replacement rule: remove legacy TMS (and consult, if enabled) then add CBA and cgTMS bundle revenue. Costs can be added explicitly.</div>
                <div className="text-xs text-slate-400">
                  Accounts selected: {scenario.legacyTmsAccounts?.length ?? 0} doctor and {scenario.legacyConsultAccounts?.length ?? 0} consult
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-100">Results &amp; sensitivity</div>
                <div className="text-xs text-slate-300">Current vs scenario (12 mo): {money(currentTotal)} to {scenarioTotal == null ? '-' : money(scenarioTotal)}</div>
                <div className="text-xs text-slate-300">High-leverage levers: rent override, TMS capacity (programs), consult inclusion, bundle COGS toggle.</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {consultModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
        <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold text-slate-100">Consult review (Bundle Finder)</div>
              <div className="text-xs text-slate-400">Bills-first view for clean exclusions. Payments nest under each bill.</div>
            </div>
            <button
              type="button"
              onClick={() => setConsultModalOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <Label>View mode</Label>
              <select
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                value={consultMode}
                onChange={(e) => setConsultMode(e.target.value as any)}
              >
                <option value="ap_bills">Doctor Bills (Accounts Payable)</option>
                <option value="mapped_accounts">Mapped Consult Accounts</option>
                <option value="all_txns">All Transactions (debug)</option>
              </select>
              <span className="text-slate-400">Bills create expense; payments are informational only.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <Label>Saved views</Label>
              <select
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                value={selectedConsultView?.name ?? ''}
                onChange={(e) => {
                  const view = consultViews.find(v => v.name === e.target.value)
                  if (!view) return
                  setConsultViewName(view.name)
                  setConsultSearch(view.search)
                  setConsultStatusFilter(view.status as any)
                  setConsultStart(view.start)
                  setConsultEnd(view.end)
                  setConsultMin(view.min)
                  setConsultMax(view.max)
                  setConsultMode(view.mode as any)
                }}
              >
                <option value="">Select view</option>
                {consultViews.map(view => (
                  <option key={view.name} value={view.name}>{view.name}</option>
                ))}
              </select>
              <Input
                className="w-48"
                value={consultViewName}
                onChange={(e) => setConsultViewName(e.target.value)}
                placeholder="Name view"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!consultViewName.trim()) return
                  const next = consultViews.filter(v => v.name !== consultViewName.trim())
                  next.push({
                    name: consultViewName.trim(),
                    search: consultSearch,
                    status: consultStatusFilter,
                    start: consultStart,
                    end: consultEnd,
                    min: consultMin,
                    max: consultMax,
                    mode: consultMode,
                  })
                  setConsultViews(next)
                }}
              >
                Save view
              </Button>
              {selectedConsultView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConsultViews(consultViews.filter(v => v.name !== selectedConsultView.name))}
                >
                  Delete view
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 lg:grid-cols-5">
              <div>
                <Label>Search</Label>
                <Input value={consultSearch} onChange={(e) => setConsultSearch(e.target.value)} placeholder="Reference / description" />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-100"
                  value={consultStatusFilter}
                  onChange={(e) => setConsultStatusFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="part-paid">Part-paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div>
                <Label>Date from</Label>
                <Input type="date" value={consultStart} onChange={(e) => setConsultStart(e.target.value)} />
              </div>
              <div>
                <Label>Date to</Label>
                <Input type="date" value={consultEnd} onChange={(e) => setConsultEnd(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Min</Label>
                  <Input type="number" value={consultMin} onChange={(e) => setConsultMin(e.target.value)} />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input type="number" value={consultMax} onChange={(e) => setConsultMax(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Label>Amount sign</Label>
                {(['all', 'positive', 'negative'] as const).map(sign => (
                  <Chip
                    key={sign}
                    className={`cursor-pointer ${consultAmountSign === sign ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                    onClick={() => setConsultAmountSign(sign)}
                  >
                    {sign === 'all' ? 'All' : sign}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Label>Contacts</Label>
                {consultDoctorOptions.length === 0 && <span className="text-slate-400">No contacts yet</span>}
                {consultDoctorOptions.map(opt => (
                  <Chip
                    key={opt.id}
                    className={`cursor-pointer ${consultDoctorFilter.includes(opt.id) ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                    onClick={() =>
                      setConsultDoctorFilter(prev =>
                        prev.includes(opt.id) ? prev.filter(id => id !== opt.id) : [...prev, opt.id]
                      )
                    }
                  >
                    {opt.label}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Label>Accounts</Label>
                {consultAccountOptions.length === 0 && <span className="text-slate-400">No accounts yet</span>}
                {consultAccountOptions.map(account => (
                  <Chip
                    key={account}
                    className={`cursor-pointer ${consultAccountFilters.includes(account) ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                    onClick={() =>
                      setConsultAccountFilters(prev =>
                        prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]
                      )
                    }
                  >
                    {account}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-100">Power tools</div>
                  <div className="text-[11px] text-slate-400">Advanced rules for pattern matching and legacy cleanup.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPowerToolsOpen(v => !v)}>
                  {powerToolsOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
              {powerToolsOpen && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={doctorFilterEnabled} onChange={() => setDoctorFilterEnabled(v => !v)} />
                    Enable doctor filter
                  </label>
                  <div>
                    <div className="text-xs text-slate-300">Doctor name patterns (regex, case-insensitive)</div>
                    <textarea
                      className="mt-2 w-full min-h-[90px] rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-xs text-slate-100"
                      value={doctorPatternDraft}
                      onChange={(e) => setDoctorPatternDraft(e.target.value)}
                      placeholder={DEFAULT_DOCTOR_PATTERNS.join('\n')}
                    />
                    {doctorPatternErrors.length > 0 && (
                      <div className="mt-2 text-xs text-rose-200 space-y-1">
                        {doctorPatternErrors.map(err => (
                          <div key={err}>{err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveDoctorPatterns()}
                      className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Save patterns
                    </button>
                    <button
                      type="button"
                      onClick={() => resetDoctorPatterns()}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {consultMode === 'ap_bills' && (
              <>
                {doctorBillGroups.length === 0 ? (
                  <div className="text-xs text-slate-300">No AP bills matched the current filters.</div>
                ) : (
                  doctorBillGroups.map(group => (
                    <div key={group.doctorContactId} className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{group.doctorLabel}</div>
                          <div className="text-xs text-slate-400">{group.bills.length} bills</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
                            value={group.rule?.default_treatment ?? 'OPERATING'}
                            onChange={(e) => {
                              const next = e.target.value as TxnTreatment
                              if (next === 'DEFERRED') {
                                saveDoctorRule(group.doctorContactId, next, {
                                  startMonth: group.rule?.deferral_start_month ?? '',
                                  months: group.rule?.deferral_months ?? 12,
                                  includeInOperatingKPIs: group.rule?.deferral_include_in_operating_kpis ?? true,
                                })
                              } else {
                                saveDoctorRule(group.doctorContactId, next)
                              }
                            }}
                          >
                            <option value="OPERATING">Operating</option>
                            <option value="NON_OPERATING">Non-operating</option>
                            <option value="DEFERRED">Deferred</option>
                            <option value="EXCLUDE">Exclude</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => saveDoctorRule(group.doctorContactId, 'EXCLUDE')}
                            className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100"
                          >
                            Exclude all
                          </button>
                          {group.rule && (
                            <button
                              type="button"
                              onClick={() => clearDoctorRule(group.doctorContactId)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                            >
                              Clear rule
                            </button>
                          )}
                        </div>
                      </div>

                      {group.rule?.default_treatment === 'DEFERRED' && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                          <label className="flex items-center gap-2">
                            Start month
                            <input
                              type="month"
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                              value={group.rule?.deferral_start_month ?? ''}
                              onChange={(e) =>
                                saveDoctorRule(group.doctorContactId, 'DEFERRED', {
                                  startMonth: e.target.value,
                                  months: group.rule?.deferral_months ?? 12,
                                  includeInOperatingKPIs: group.rule?.deferral_include_in_operating_kpis ?? true,
                                })
                              }
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            Months
                            <input
                              type="number"
                              min={1}
                              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                              value={group.rule?.deferral_months ?? 12}
                              onChange={(e) =>
                                saveDoctorRule(group.doctorContactId, 'DEFERRED', {
                                  startMonth: group.rule?.deferral_start_month ?? '',
                                  months: Number(e.target.value),
                                  includeInOperatingKPIs: group.rule?.deferral_include_in_operating_kpis ?? true,
                                })
                              }
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={group.rule?.deferral_include_in_operating_kpis ?? true}
                              onChange={(e) =>
                                saveDoctorRule(group.doctorContactId, 'DEFERRED', {
                                  startMonth: group.rule?.deferral_start_month ?? '',
                                  months: group.rule?.deferral_months ?? 12,
                                  includeInOperatingKPIs: e.target.checked,
                                })
                              }
                            />
                            Include in operating KPIs
                          </label>
                        </div>
                      )}

                      <div className="space-y-2">
                        {group.bills.map((item: any) => (
                          <div key={item.billHash} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-100">{item.bill.reference ?? item.bill.description ?? 'Bill'}</div>
                                <div className="text-xs text-slate-400">{item.bill.date}</div>
                                <div className="text-xs text-slate-300">Amount: {money(item.bill.amount)}</div>
                                <div className="text-[11px] text-slate-400">Status: {item.status}</div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <select
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
                                  value={item.resolved.treatment}
                                  onChange={(e) => {
                                    const next = e.target.value as TxnTreatment
                                    if (next === 'DEFERRED') {
                                      saveBillOverride(item.bill, next, {
                                        startMonth: item.resolved.deferral?.startMonth ?? '',
                                        months: item.resolved.deferral?.months ?? 12,
                                        includeInOperatingKPIs: item.resolved.deferral?.includeInOperatingKPIs ?? true,
                                      })
                                    } else {
                                      saveBillOverride(item.bill, next)
                                    }
                                  }}
                                >
                                  <option value="OPERATING">Operating</option>
                                  <option value="NON_OPERATING">Non-operating</option>
                                  <option value="DEFERRED">Deferred</option>
                                  <option value="EXCLUDE">Exclude</option>
                                </select>
                                {item.override && (
                                  <button
                                    type="button"
                                    onClick={() => clearBillOverride(item.override.id)}
                                    className="text-[10px] text-slate-400 hover:text-slate-200"
                                  >
                                    Revert to doctor default
                                  </button>
                                )}
                              </div>
                            </div>

                            {item.resolved.treatment === 'DEFERRED' && (
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                                <label className="flex items-center gap-2">
                                  Start month
                                  <input
                                    type="month"
                                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                                    value={item.resolved.deferral?.startMonth ?? ''}
                                    onChange={(e) =>
                                      saveBillOverride(item.bill, 'DEFERRED', {
                                        startMonth: e.target.value,
                                        months: item.resolved.deferral?.months ?? 12,
                                        includeInOperatingKPIs: item.resolved.deferral?.includeInOperatingKPIs ?? true,
                                      })
                                    }
                                  />
                                </label>
                                <label className="flex items-center gap-2">
                                  Months
                                  <input
                                    type="number"
                                    min={1}
                                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                                    value={item.resolved.deferral?.months ?? 12}
                                    onChange={(e) =>
                                      saveBillOverride(item.bill, 'DEFERRED', {
                                        startMonth: item.resolved.deferral?.startMonth ?? '',
                                        months: Number(e.target.value),
                                        includeInOperatingKPIs: item.resolved.deferral?.includeInOperatingKPIs ?? true,
                                      })
                                    }
                                  />
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.resolved.deferral?.includeInOperatingKPIs ?? true}
                                    onChange={(e) =>
                                      saveBillOverride(item.bill, 'DEFERRED', {
                                        startMonth: item.resolved.deferral?.startMonth ?? '',
                                        months: item.resolved.deferral?.months ?? 12,
                                        includeInOperatingKPIs: e.target.checked,
                                      })
                                    }
                                  />
                                  Include in operating KPIs
                                </label>
                              </div>
                            )}

                            {item.payments.length > 0 && (
                              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="text-[11px] font-semibold text-slate-300 mb-1">Payments</div>
                                <div className="space-y-1 text-[11px] text-slate-300">
                                  {item.payments.map((pay: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between">
                                      <span>{pay.date} {pay.description ?? pay.reference ?? 'Payment'}</span>
                                      <span>{money(pay.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {consultMode === 'mapped_accounts' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300">
                  Legacy consult account review (fallback). AP Bills mode is recommended for clean exclusions.
                </div>
                {legacyConsultGroups.length === 0 ? (
                  <div className="text-xs text-slate-400">No consult transactions matched the current filters.</div>
                ) : (
                  legacyConsultGroups.map(group => (
                    <div key={group.account} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold text-slate-100">{group.account}</div>
                      <div className="text-xs text-slate-400">{group.txns.length} transactions</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {consultMode === 'all_txns' && (
              <div className="text-xs text-slate-300">All transactions view is not yet optimized.</div>
            )}
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

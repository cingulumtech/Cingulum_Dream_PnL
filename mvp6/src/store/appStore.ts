import { create } from 'zustand'
import { DEFAULT_DREAM_TEMPLATE } from '../lib/dream/template'
import { ensureTemplateMetadata } from '../lib/dream/schema'
import { RECOMMENDED_DEFAULTS, type FrameworkDefaults } from '../lib/defaults'
import { ensureExportSettings, ensureReportConfig, type SnapshotReportConfig, type SnapshotSummary } from '../lib/snapshotUtils'
import { DoctorRule, DreamTemplate, GL, ScenarioInputs, TxnOverride, XeroPL } from '../lib/types'

export type View =
  | 'overview'
  | 'pnlLegacy'
  | 'pnlManagement'
  | 'mapping'
  | 'layout'
  | 'reports'
  | 'snapshots'
  | 'settings'
  | 'help'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type SnapshotItem = {
  id: string
  name: string
  ownerEmail: string
  ownerId: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
  summary?: SnapshotSummary
}

export type ImportItem = {
  id: string
  name: string
  kind: string
  status: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

type AppState = {
  view: View
  setView: (v: View) => void

  pl: XeroPL | null
  plLoadedAt: string | null
  setPL: (pl: XeroPL | null) => void

  gl: GL | null
  glLoadedAt: string | null
  setGL: (gl: GL | null) => void

  template: DreamTemplate
  setTemplate: (t: DreamTemplate, opts?: { skipHistory?: boolean; preserveVersion?: boolean; quiet?: boolean }) => void
  resetTemplate: () => void
  undoTemplate: () => void
  redoTemplate: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  templateHistory: DreamTemplate[]
  templateFuture: DreamTemplate[]
  lastTemplateSavedAt: string | null

  selectedLineId: string | null
  setSelectedLineId: (id: string | null) => void

  scenario: ScenarioInputs
  setScenario: (s: Partial<ScenarioInputs>) => void

  defaults: FrameworkDefaults
  setDefaults: (d: Partial<AppState['defaults']>) => void
  resetDefaults: () => void

  reportConfig: SnapshotReportConfig
  setReportConfig: (cfg: Partial<SnapshotReportConfig>) => void

  activeSnapshotId: string | null
  setActiveSnapshotId: (id: string | null) => void

  snapshots: SnapshotItem[]
  setSnapshots: (snaps: SnapshotItem[]) => void
  upsertSnapshot: (snap: SnapshotItem) => void
  removeSnapshot: (id: string) => void

  imports: ImportItem[]
  setImports: (imports: ImportItem[]) => void
  addImport: (item: ImportItem) => void

  txnOverrides: TxnOverride[]
  upsertTxnOverride: (override: TxnOverride) => void
  removeTxnOverride: (overrideId: string) => void

  doctorRules: DoctorRule[]
  upsertDoctorRule: (rule: DoctorRule) => void
  removeDoctorRule: (contactId: string) => void

  doctorPatterns: string[]
  setDoctorPatterns: (patterns: string[]) => void

  hydrated: boolean
  setHydrated: (hydrated: boolean) => void

  templateSaveStatus: SaveStatus
  reportSaveStatus: SaveStatus
  settingsSaveStatus: SaveStatus
  setTemplateSaveStatus: (status: SaveStatus) => void
  setReportSaveStatus: (status: SaveStatus) => void
  setSettingsSaveStatus: (status: SaveStatus) => void
}

export const useAppStore = create<AppState>()((set, get) => ({
  view: 'overview',
  setView: (v) => set({ view: v }),

  pl: null,
  plLoadedAt: null,
  setPL: (pl) => set({ pl, plLoadedAt: pl ? new Date().toISOString() : null }),

  gl: null,
  glLoadedAt: null,
  setGL: (gl) => set({ gl, glLoadedAt: gl ? new Date().toISOString() : null }),

  template: DEFAULT_DREAM_TEMPLATE,
  templateHistory: [],
  templateFuture: [],
  lastTemplateSavedAt: null,
  setTemplate: (t, opts) => {
    set(state => {
      const next = ensureTemplateMetadata(t, { preserveVersion: opts?.preserveVersion })
      const history = opts?.skipHistory ? state.templateHistory : [state.template, ...state.templateHistory].slice(0, 20)
      return {
        template: next,
        templateHistory: history,
        templateFuture: [],
        lastTemplateSavedAt: opts?.quiet ? state.lastTemplateSavedAt : new Date().toISOString(),
      }
    })
  },
  resetTemplate: () =>
    set(state => ({
      templateHistory: [state.template, ...state.templateHistory].slice(0, 20),
      templateFuture: [],
      template: ensureTemplateMetadata(DEFAULT_DREAM_TEMPLATE, { preserveVersion: true }),
      lastTemplateSavedAt: new Date().toISOString(),
    })),
  undoTemplate: () =>
    set(state => {
      if (!state.templateHistory.length) return state
      const [prev, ...rest] = state.templateHistory
      return {
        template: prev,
        templateHistory: rest,
        templateFuture: [state.template, ...state.templateFuture].slice(0, 20),
        lastTemplateSavedAt: new Date().toISOString(),
      }
    }),
  redoTemplate: () =>
    set(state => {
      if (!state.templateFuture.length) return state
      const [next, ...rest] = state.templateFuture
      return {
        template: next,
        templateHistory: [state.template, ...state.templateHistory].slice(0, 20),
        templateFuture: rest,
        lastTemplateSavedAt: new Date().toISOString(),
      }
    }),
  canUndo: () => get().templateHistory.length > 0,
  canRedo: () => get().templateFuture.length > 0,

  selectedLineId: null,
  setSelectedLineId: (id) => set({ selectedLineId: id }),

  scenario: {
    enabled: false,
    legacyTmsAccountMatchers: ['tms', 'cgtms', 'rTMS', 'transcranial'],
    legacyTmsAccounts: [],
    includeDoctorConsultsInBundle: false,
    legacyConsultAccountMatchers: ['consult', 'appointment', 'dr ', 'doctor'],
    legacyConsultAccounts: [],

    state: 'NSW/QLD',

    doctorServiceFeePct: 15,

    // Volumes (per month)
    cbaMonthlyCount: 0,
    programMonthlyCount: 0,

    // Revenue (default to the current framework totals)
    cbaPrice: 1325,
    programPrice: 10960,

    // Cost treatment
    addBundleCostsToScenario: true,

    // CBA costs (from framework)
    cbaIncludeMRI: true,
    cbaMriCost: 380,
    cbaMriPatientFee: 400,
    cbaIncludeQuicktome: true,
    cbaQuicktomeCost: 200,
    cbaQuicktomePatientFee: 200,
    cbaIncludeCreyos: true,
    cbaCreyosCost: 50,
    cbaCreyosPatientFee: 75,
    cbaIncludeInitialConsult: true,
    cbaInitialConsultFee: 650,
    cbaInitialConsultCount: 1,
    cbaOtherCogsPerAssessment: 0,

    // cgTMS program costs (from framework)
    progIncludePostMRI: true,
    progMriCost: 380,
    progMriPatientFee: 400,
    progIncludeQuicktome: true,
    progQuicktomeCost: 200,
    progQuicktomePatientFee: 200,
    // Creyos is billed once in CBA (keep off here)
    progIncludeCreyos: false,
    progCreyosCost: 0,
    progCreyosPatientFee: 0,
    progInclude6WkConsult: true,
    prog6WkConsultFee: 450,
    prog6WkConsultCount: 1,
    progIncludeAdjunctAllowance: true,
    progAdjunctAllowance: 560,
    // 6-month consult is auto-included from the 6-week consult (counts kept in sync in UI)
    progInclude6MoConsult: true,
    prog6MoConsultFee: 450,
    prog6MoConsultCount: 1,
    progInclude6MoCreyos: false,
    prog6MoCreyosCost: 0,
    prog6MoCreyosPatientFee: 0,
    progTreatmentDeliveryCost: 0,
    progOtherCogsPerProgram: 0,

    // Shifting-the-needle levers
    rentEnabled: false,
    rentAccountMatchers: ['rent', 'lease'],
    rentMode: 'fixed',
    rentFixedMonthly: 0,
    rentPercentPerMonth: 0,

    machinesEnabled: false,
    tmsMachines: 1,
    patientsPerMachinePerWeek: 4,
    weeksPerYear: 52,
    utilisation: 0.65,
    excludedConsultAccounts: [],
    excludedConsultTxnKeys: [],
  },
  setScenario: (s) => set({ scenario: { ...get().scenario, ...s } }),

  defaults: RECOMMENDED_DEFAULTS,
  setDefaults: (d) => set({ defaults: { ...get().defaults, ...d, exportSettings: ensureExportSettings({ ...get().defaults.exportSettings, ...d?.exportSettings }) } }),
  resetDefaults: () => set({ defaults: RECOMMENDED_DEFAULTS }),

  reportConfig: ensureReportConfig(),
  setReportConfig: (cfg) => set({ reportConfig: { ...get().reportConfig, ...cfg } }),

  activeSnapshotId: null,
  setActiveSnapshotId: (id) => set({ activeSnapshotId: id }),

  snapshots: [],
  setSnapshots: (snaps) => set({ snapshots: snaps }),
  upsertSnapshot: (snap) =>
    set(state => {
      const rest = state.snapshots.filter(s => s.id !== snap.id)
      return { snapshots: [snap, ...rest] }
    }),
  removeSnapshot: (id) =>
    set(state => ({
      snapshots: state.snapshots.filter(s => s.id !== id),
      activeSnapshotId: state.activeSnapshotId === id ? null : state.activeSnapshotId,
    })),

  imports: [],
  setImports: (imports) => set({ imports }),
  addImport: (item) => set(state => ({ imports: [item, ...state.imports] })),

  txnOverrides: [],
  upsertTxnOverride: (override) =>
    set(state => {
      const rest = state.txnOverrides.filter(o => o.id !== override.id)
      return { txnOverrides: [override, ...rest] }
    }),
  removeTxnOverride: (overrideId) =>
    set(state => ({ txnOverrides: state.txnOverrides.filter(o => o.id !== overrideId) })),

  doctorRules: [],
  upsertDoctorRule: (rule) =>
    set(state => {
      const rest = state.doctorRules.filter(r => r.contact_id !== rule.contact_id)
      return { doctorRules: [rule, ...rest] }
    }),
  removeDoctorRule: (contactId) =>
    set(state => ({ doctorRules: state.doctorRules.filter(r => r.contact_id !== contactId) })),

  doctorPatterns: [],
  setDoctorPatterns: (patterns) => set({ doctorPatterns: patterns }),

  hydrated: false,
  setHydrated: (hydrated) => set({ hydrated }),

  templateSaveStatus: 'idle',
  reportSaveStatus: 'idle',
  settingsSaveStatus: 'idle',
  setTemplateSaveStatus: (status) => set({ templateSaveStatus: status }),
  setReportSaveStatus: (status) => set({ reportSaveStatus: status }),
  setSettingsSaveStatus: (status) => set({ settingsSaveStatus: status }),
}))

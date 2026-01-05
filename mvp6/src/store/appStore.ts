import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DREAM_TEMPLATE } from '../lib/dream/template'
import { GL, ScenarioInputs, XeroPL, DreamTemplate } from '../lib/types'
import { ensureTemplateMetadata } from '../lib/dream/schema'

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
  setTemplate: (t: DreamTemplate, opts?: { skipHistory?: boolean; preserveVersion?: boolean }) => void
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

  snapshots: {
    id: string
    name: string
    createdAt: string
    scenario: ScenarioInputs
    template: DreamTemplate
    pl: XeroPL | null
    gl: GL | null
    reportConfig: SnapshotReportConfig
    exportSettings: FrameworkDefaults['exportSettings']
    fingerprints: {
      pl?: DatasetFingerprint
      gl?: DatasetFingerprint
      templateVersion: string
      layoutHash: string
    }
    summary: SnapshotSummary
  }[]
  addSnapshot: (name: string) => void
  loadSnapshot: (id: string) => void
  deleteSnapshot: (id: string) => void
  clearActiveSnapshot: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
            lastTemplateSavedAt: new Date().toISOString(),
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
        includeDoctorConsultsInBundle: false,
        legacyConsultAccountMatchers: ['consult', 'appointment', 'dr ', 'doctor'],

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
      snapshots: [],
      addSnapshot: (name) => {
        const state = get()
        const reportConfig = ensureReportConfig(state.reportConfig)
        const exportSettings = ensureExportSettings(state.defaults.exportSettings)
        const templateFingerprint = fingerprintTemplate(state.template)
        const snapshot = {
          id: crypto.randomUUID(),
          name,
          createdAt: new Date().toISOString(),
          scenario: state.scenario,
          template: state.template,
          pl: state.pl,
          gl: state.gl,
          reportConfig,
          exportSettings,
          fingerprints: {
            pl: fingerprintPl(state.pl),
            gl: fingerprintGl(state.gl),
            templateVersion: templateFingerprint.templateVersion,
            layoutHash: templateFingerprint.layoutHash,
          },
          summary: buildSnapshotSummary({
            pl: state.pl,
            template: state.template,
            scenario: state.scenario,
            reportConfig,
          }),
        }
        set({ snapshots: [snapshot, ...state.snapshots].slice(0, 20), activeSnapshotId: snapshot.id })
      },
      loadSnapshot: (id) => {
        const state = get()
        const snap = state.snapshots.find(s => s.id === id)
        if (!snap) return
        set({
          scenario: snap.scenario,
          template: ensureTemplateMetadata(snap.template, { preserveVersion: true }),
          templateHistory: [],
          templateFuture: [],
          lastTemplateSavedAt: new Date().toISOString(),
          pl: snap.pl,
          gl: snap.gl,
          activeSnapshotId: id,
        })
      },
      deleteSnapshot: (id) => {
        const state = get()
        const nextSnapshots = state.snapshots.filter(s => s.id !== id)
        set({
          snapshots: nextSnapshots,
          activeSnapshotId: state.activeSnapshotId === id ? null : state.activeSnapshotId,
        })
      },
      clearActiveSnapshot: () => set({ activeSnapshotId: null }),
    }),
    {
      name: 'cingulum-dream-pnl',
      partialize: (state) => ({
        template: state.template,
        templateHistory: state.templateHistory,
        templateFuture: state.templateFuture,
        lastTemplateSavedAt: state.lastTemplateSavedAt,
        scenario: state.scenario,
        defaults: state.defaults,
        snapshots: state.snapshots,
        activeSnapshotId: state.activeSnapshotId,
      }),
      // Keep backward compatibility when we add new scenario keys (avoid old persisted state wiping defaults)
      merge: (persisted: any, current) => {
        const defaults = current.scenario
        const incoming = persisted?.scenario ?? {}

        const sanitizeScenario = (src: any, fallback: typeof defaults): typeof defaults => {
          const result: any = { ...fallback }
          for (const [key, value] of Object.entries(src ?? {})) {
            if (value === undefined || value === null) continue
            if (typeof value === 'string' && value.trim() === '') continue
            if (Array.isArray(value)) {
              // For matcher arrays, keep defaults when the persisted array is empty
              result[key] = value.length ? value : (fallback as any)[key] ?? []
              continue
            }
            result[key] = value as any
          }
          return result as typeof defaults
        }

        const mergedDefaults = { ...RECOMMENDED_DEFAULTS, ...(persisted?.defaults ?? current.defaults) }
        mergedDefaults.exportSettings = ensureExportSettings(mergedDefaults.exportSettings)

        const hydrateSnapshots = (snaps: any[] | undefined) =>
          (snaps ?? []).map((s) => {
            const reportConfig = ensureReportConfig(s.reportConfig ?? current.reportConfig)
            const exportSettings = ensureExportSettings(s.exportSettings ?? mergedDefaults.exportSettings)
            const templateFingerprint = fingerprintTemplate(s.template ?? current.template)
            return {
              ...s,
              reportConfig,
              exportSettings,
              fingerprints: s.fingerprints ?? {
                pl: fingerprintPl(s.pl ?? null),
                gl: fingerprintGl(s.gl ?? null),
                templateVersion: templateFingerprint.templateVersion,
                layoutHash: templateFingerprint.layoutHash,
              },
              summary: s.summary ?? buildSnapshotSummary({
                pl: s.pl ?? null,
                template: s.template ?? current.template,
                scenario: s.scenario ?? current.scenario,
                reportConfig,
              }),
            }
          })

        return {
          ...current,
          ...persisted,
          template: ensureTemplateMetadata(persisted?.template ?? current.template, { preserveVersion: true }),
          templateHistory: (persisted?.templateHistory ?? []).slice(0, 20),
          templateFuture: (persisted?.templateFuture ?? []).slice(0, 20),
          lastTemplateSavedAt: persisted?.lastTemplateSavedAt ?? current.lastTemplateSavedAt,
          scenario: sanitizeScenario(incoming, defaults),
          defaults: persisted?.defaults ?? current.defaults,
          snapshots: persisted?.snapshots ?? current.snapshots,
          activeSnapshotId: persisted?.activeSnapshotId ?? current.activeSnapshotId,
        }
      },
    }
  )
)

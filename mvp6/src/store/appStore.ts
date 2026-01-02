import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DREAM_TEMPLATE } from '../lib/dream/template'
import { GL, ScenarioInputs, XeroPL, DreamTemplate } from '../lib/types'
import { FrameworkDefaults, RECOMMENDED_DEFAULTS } from '../lib/defaults'
import {
  buildSnapshotSummary,
  DatasetFingerprint,
  ensureExportSettings,
  ensureReportConfig,
  fingerprintGl,
  fingerprintPl,
  fingerprintTemplate,
  SnapshotReportConfig,
  SnapshotSummary,
} from '../lib/snapshotUtils'

export type View = 'overview' | 'legacy' | 'dream' | 'mapping' | 'scenario' | 'help' | 'settings' | 'exports' | 'reports'

type AppState = {
  view: View
  setView: (v: View) => void

  pl: XeroPL | null
  setPL: (pl: XeroPL | null) => void

  gl: GL | null
  setGL: (gl: GL | null) => void

  template: DreamTemplate
  setTemplate: (t: DreamTemplate) => void
  resetTemplate: () => void

  selectedLineId: string | null
  setSelectedLineId: (id: string | null) => void

  scenario: ScenarioInputs
  setScenario: (s: Partial<ScenarioInputs>) => void

  defaults: FrameworkDefaults
  setDefaults: (d: Partial<AppState['defaults']>) => void
  resetDefaults: () => void

  reportConfig: SnapshotReportConfig
  setReportConfig: (cfg: Partial<SnapshotReportConfig>) => void

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
  renameSnapshot: (id: string, name: string) => void
  duplicateSnapshot: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'overview',
      setView: (v) => set({ view: v }),

      pl: null,
      setPL: (pl) => set({ pl }),

      gl: null,
      setGL: (gl) => set({ gl }),

      template: DEFAULT_DREAM_TEMPLATE,
      setTemplate: (t) => set({ template: t }),
      resetTemplate: () => set({ template: DEFAULT_DREAM_TEMPLATE }),

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
        set({ snapshots: [snapshot, ...state.snapshots].slice(0, 20) })
      },
      loadSnapshot: (id) => {
        const state = get()
        const snap = state.snapshots.find(s => s.id === id)
        if (!snap) return
        set({
          scenario: snap.scenario,
          template: snap.template,
          pl: snap.pl,
          gl: snap.gl,
          reportConfig: snap.reportConfig,
          defaults: { ...state.defaults, exportSettings: snap.exportSettings },
        })
      },
      deleteSnapshot: (id) => {
        set({ snapshots: get().snapshots.filter(s => s.id !== id) })
      },
      renameSnapshot: (id, name) => {
        set({ snapshots: get().snapshots.map(s => (s.id === id ? { ...s, name } : s)) })
      },
      duplicateSnapshot: (id) => {
        const state = get()
        const snap = state.snapshots.find(s => s.id === id)
        if (!snap) return
        const copy = { ...snap, id: crypto.randomUUID(), name: `${snap.name} (copy)`, createdAt: new Date().toISOString() }
        set({ snapshots: [copy, ...state.snapshots].slice(0, 20) })
      },
    }),
    {
      name: 'cingulum-dream-pnl',
      partialize: (state) => ({
        template: state.template,
        scenario: state.scenario,
        defaults: state.defaults,
        snapshots: state.snapshots,
        reportConfig: state.reportConfig,
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
          template: persisted?.template ?? current.template,
          scenario: sanitizeScenario(incoming, defaults),
          defaults: mergedDefaults as FrameworkDefaults,
          snapshots: hydrateSnapshots(persisted?.snapshots ?? current.snapshots),
          reportConfig: ensureReportConfig(persisted?.reportConfig ?? current.reportConfig),
        }
      },
    }
  )
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DREAM_TEMPLATE } from '../lib/dream/template'
import { GL, ScenarioInputs, XeroPL, DreamTemplate } from '../lib/types'

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

  defaults: {
    suggestedCbaPrice: Record<'NSW/QLD' | 'WA' | 'VIC', number>
    suggestedProgramPrice: Record<'NSW/QLD' | 'WA' | 'VIC', number>
    mriCostByState: Record<'NSW/QLD' | 'WA' | 'VIC', number>
    mriPatientByState: Record<'NSW/QLD' | 'WA' | 'VIC', number>
    doctorServiceFeePct: number
  }
  setDefaults: (d: Partial<AppState['defaults']>) => void

  activeSnapshotId: string | null

  snapshots: {
    id: string
    name: string
    createdAt: string
    scenario: ScenarioInputs
    template: DreamTemplate
    pl: XeroPL | null
    gl: GL | null
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

      defaults: {
        suggestedCbaPrice: { 'NSW/QLD': 1325, WA: 1475, VIC: 925 },
        suggestedProgramPrice: { 'NSW/QLD': 10960, WA: 11110, VIC: 10560 },
        mriCostByState: { 'NSW/QLD': 380, WA: 750, VIC: 0 },
        mriPatientByState: { 'NSW/QLD': 400, WA: 770, VIC: 0 },
        doctorServiceFeePct: 15,
      },
      setDefaults: (d) => set({ defaults: { ...get().defaults, ...d } }),

      activeSnapshotId: null,
      snapshots: [],
      addSnapshot: (name) => {
        const state = get()
        const snapshot = {
          id: crypto.randomUUID(),
          name,
          createdAt: new Date().toISOString(),
          scenario: state.scenario,
          template: state.template,
          pl: state.pl,
          gl: state.gl,
        }
        set({ snapshots: [snapshot, ...state.snapshots].slice(0, 20), activeSnapshotId: snapshot.id })
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

        return {
          ...current,
          ...persisted,
          template: persisted?.template ?? current.template,
          scenario: sanitizeScenario(incoming, defaults),
          defaults: persisted?.defaults ?? current.defaults,
          snapshots: persisted?.snapshots ?? current.snapshots,
          activeSnapshotId: persisted?.activeSnapshotId ?? current.activeSnapshotId,
        }
      },
    }
  )
)

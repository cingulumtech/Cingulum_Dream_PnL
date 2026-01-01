import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DREAM_TEMPLATE } from '../lib/dream/template'
import { GL, ScenarioInputs, XeroPL, DreamTemplate } from '../lib/types'

export type View = 'overview' | 'legacy' | 'dream' | 'mapping' | 'scenario' | 'help'

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
      },
      setScenario: (s) => set({ scenario: { ...get().scenario, ...s } }),
    }),
    {
      name: 'cingulum-dream-pnl',
      partialize: (state) => ({
        template: state.template,
        scenario: state.scenario,
      }),
      // Keep backward compatibility when we add new scenario keys (avoid old persisted state wiping defaults)
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        template: persisted?.template ?? current.template,
        scenario: { ...current.scenario, ...(persisted?.scenario ?? {}) },
      }),
    }
  )
)

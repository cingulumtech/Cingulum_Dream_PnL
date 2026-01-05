export type ExportSettings = {
  pageSize: 'a4' | 'letter'
  marginMm: number
}

export type FrameworkDefaults = {
  suggestedCbaPrice: Record<'NSW/QLD' | 'WA' | 'VIC', number>
  suggestedProgramPrice: Record<'NSW/QLD' | 'WA' | 'VIC', number>
  mriCostByState: Record<'NSW/QLD' | 'WA' | 'VIC', number>
  mriPatientByState: Record<'NSW/QLD' | 'WA' | 'VIC', number>
  doctorServiceFeePct: number
  exportSettings: ExportSettings
}

export const RECOMMENDED_DEFAULTS: FrameworkDefaults = {
  suggestedCbaPrice: { 'NSW/QLD': 1325, WA: 1475, VIC: 925 },
  suggestedProgramPrice: { 'NSW/QLD': 10960, WA: 11110, VIC: 10560 },
  mriCostByState: { 'NSW/QLD': 380, WA: 750, VIC: 0 },
  mriPatientByState: { 'NSW/QLD': 400, WA: 770, VIC: 0 },
  doctorServiceFeePct: 15,
  exportSettings: {
    pageSize: 'a4',
    marginMm: 12,
  },
}

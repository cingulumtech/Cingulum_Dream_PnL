import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { calcMappingStats } from '../lib/reportData'
import { Chip } from './ui'

function StatusItem({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return (
    <Chip
      tone={tone}
      className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
    >
      {label}
    </Chip>
  )
}

export function StatusStrip() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const template = useAppStore(s => s.template)
  const scenario = useAppStore(s => s.scenario)

  const mappingCompleteness = useMemo(() => {
    if (!pl) return 0
    return calcMappingStats(pl, template).completeness
  }, [pl, template])

  const mappingLabel = `Mapping ${(mappingCompleteness * 100).toFixed(0)}%`
  const scenarioReady = scenario.enabled
  const reportReady = !!pl && mappingCompleteness >= 0.85

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusItem label={`P&L ${pl ? 'Loaded' : 'Missing'}`} tone={pl ? 'good' : 'bad'} />
      <StatusItem label={`GL ${gl ? 'Loaded' : 'Optional'}`} tone={gl ? 'good' : 'warn'} />
      <StatusItem label={mappingLabel} tone={mappingCompleteness >= 0.85 ? 'good' : 'warn'} />
      <StatusItem label={scenarioReady ? 'Scenario Ready' : 'Scenario Off'} tone={scenarioReady ? 'good' : 'neutral'} />
      <StatusItem label={reportReady ? 'Report Ready' : 'Report Pending'} tone={reportReady ? 'good' : 'warn'} />
    </div>
  )
}

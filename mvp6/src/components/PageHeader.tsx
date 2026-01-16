import { ReactNode } from 'react'
import { StatusStrip } from './StatusStrip'

export function PageHeader({
  title,
  subtitle,
  actions,
  statusSlot,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  statusSlot?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-100">{title}</div>
          {subtitle ? <div className="text-sm text-slate-300 mt-1">{subtitle}</div> : null}
        </div>
        <div className="flex flex-col gap-3 items-start lg:items-end">
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          {statusSlot ?? <StatusStrip />}
        </div>
      </div>
    </div>
  )
}

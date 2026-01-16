import React from 'react'
import { SaveStatus } from '../store/appStore'

export function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  const label = status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save failed'
  const tone = status === 'saving'
    ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-100'
    : status === 'saved'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
      : 'border-rose-400/30 bg-rose-500/10 text-rose-100'

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>
  )
}

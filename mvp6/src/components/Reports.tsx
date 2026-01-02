import React from 'react'
import { Card } from './ui'

export function Reports() {
  const generate = () => {
    window.print()
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-100">Investor report</div>
        <div className="text-xs text-slate-400">Generate a printable/PDF-ready summary of the current state.</div>
        <button
          type="button"
          onClick={generate}
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
        >
          Generate &amp; print / save PDF
        </button>
      </Card>
    </div>
  )
}

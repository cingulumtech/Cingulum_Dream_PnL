import React, { useRef, useState } from 'react'
import { Upload, FileText, Trash2 } from 'lucide-react'
import { parseXeroProfitAndLoss } from '../lib/xero/plParser'
import { parseXeroGeneralLedgerDetail } from '../lib/xero/glParser'
import { useAppStore } from '../store/appStore'
import { Button, Card, Chip, Input, Label } from './ui'

async function readFileAsArrayBuffer(file: File) {
  return await file.arrayBuffer()
}

export function UploadPanel() {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const setPL = useAppStore(s => s.setPL)
  const setGL = useAppStore(s => s.setGL)

  const [status, setStatus] = useState<string>('')
  const [err, setErr] = useState<string>('')

  const plInput = useRef<HTMLInputElement>(null)
  const glInput = useRef<HTMLInputElement>(null)

  async function onPickPL(file: File | null) {
    if (!file) return
    setErr('')
    setStatus('Parsing Profit & Loss…')
    try {
      const buf = await readFileAsArrayBuffer(file)
      const parsed = parseXeroProfitAndLoss(buf)
      setPL(parsed)
      setStatus(`Loaded P&L: ${parsed.accounts.length} accounts × ${parsed.months.length} months`)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setStatus('')
    }
  }

  async function onPickGL(file: File | null) {
    if (!file) return
    setErr('')
    setStatus('Parsing General Ledger Detail…')
    try {
      const buf = await readFileAsArrayBuffer(file)
      const parsed = parseXeroGeneralLedgerDetail(buf)
      setGL(parsed)
      setStatus(`Loaded GL: ${parsed.txns.length.toLocaleString()} transactions`)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setStatus('')
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Load Xero exports</div>
          <div className="text-sm text-slate-300">
            Upload the Xero <span className="font-semibold">Profit &amp; Loss</span> export and (optional){' '}
            <span className="font-semibold">General Ledger Detail</span> export for drill-down.
          </div>
        </div>
        <Button variant="ghost" onClick={() => { setPL(null); setGL(null); setStatus(''); setErr('') }}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>

      {/* Sidebar is narrow even on large screens; keep this 1-column to avoid squishing */}
      <div className="mt-5 grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Profit &amp; Loss</div>
            {pl ? <Chip tone="good">Loaded</Chip> : <Chip>Required</Chip>}
          </div>
          <div className="mt-3 flex">
            <input
              ref={plInput}
              id="pl-upload-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => onPickPL(e.target.files?.[0] ?? null)}
            />
            <Button className="w-full" onClick={() => plInput.current?.click()}>
              <Upload className="h-4 w-4" /> Choose file
            </Button>
          </div>
          {pl && (
            <div className="mt-3 text-xs text-slate-300">
              {pl.accounts.length.toLocaleString()} accounts · {pl.months.length} months
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">General Ledger Detail</div>
            {gl ? <Chip tone="good">Loaded</Chip> : <Chip>Optional</Chip>}
          </div>
          <div className="mt-3 flex">
            <input
              ref={glInput}
              id="gl-upload-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => onPickGL(e.target.files?.[0] ?? null)}
            />
            <Button className="w-full" variant="ghost" onClick={() => glInput.current?.click()}>
              <FileText className="h-4 w-4" /> Choose file
            </Button>
          </div>
          {gl && <div className="mt-3 text-xs text-slate-300">{gl.txns.length.toLocaleString()} transactions</div>}
        </div>
      </div>

      <div className="mt-4">
        {status && <div className="text-sm text-slate-200">{status}</div>}
        {err && <div className="mt-2 text-sm text-rose-200">{err}</div>}
      </div>
    </Card>
  )
}

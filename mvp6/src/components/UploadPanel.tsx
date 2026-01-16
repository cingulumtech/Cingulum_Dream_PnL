import React, { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Trash2 } from 'lucide-react'
import { parseXeroProfitAndLoss } from '../lib/xero/plParser'
import { parseXeroGeneralLedgerDetail } from '../lib/xero/glParser'
import { useAppStore } from '../store/appStore'
import { Button, Card, Chip } from './ui'
import { api } from '../lib/api'

async function readFileAsArrayBuffer(file: File) {
  return await file.arrayBuffer()
}

export function UploadPanel({ disabled = false }: { disabled?: boolean }) {
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const setPL = useAppStore(s => s.setPL)
  const setGL = useAppStore(s => s.setGL)
  const addImport = useAppStore(s => s.addImport)
  const xeroProfitLossUrl = 'https://reporting.xero.com/!Xp!d2/v1/Run/15056556'
  const xeroGeneralLedgerUrl = 'https://reporting.xero.com/!Xp!d2/v1/Run/1071'

  const [status, setStatus] = useState<string>('')
  const [err, setErr] = useState<string>('')
  const [xeroStatus, setXeroStatus] = useState<{ connected: boolean; tenantId?: string | null }>({ connected: false })
  const [xeroTenants, setXeroTenants] = useState<{ tenantId: string; tenantName: string }[]>([])
  const [xeroTenantChoice, setXeroTenantChoice] = useState<string>('')
  const [xeroFromDate, setXeroFromDate] = useState<string>('')
  const [xeroToDate, setXeroToDate] = useState<string>('')
  const [xeroSyncing, setXeroSyncing] = useState<boolean>(false)

  const plInput = useRef<HTMLInputElement>(null)
  const glInput = useRef<HTMLInputElement>(null)

  async function refreshXeroStatus() {
    try {
      const res = await api.xeroStatus()
      setXeroStatus(res)
      if (res.tenantId) setXeroTenantChoice(res.tenantId)
    } catch (e) {
      setXeroStatus({ connected: false })
    }
  }

  useEffect(() => {
    refreshXeroStatus()
  }, [])

  async function onPickPL(file: File | null) {
    if (!file) return
    setErr('')
    setStatus('Parsing Profit & Loss...')
    try {
      const buf = await readFileAsArrayBuffer(file)
      const parsed = parseXeroProfitAndLoss(buf)
      setPL(parsed)
      api
        .createImport({
          name: file.name,
          kind: 'pl',
          status: 'processed',
          metadata: { accounts: parsed.accounts.length, months: parsed.months.length, source: 'xero' },
        })
        .then((record) =>
          addImport({
            id: record.id,
            name: record.name,
            kind: record.kind,
            status: record.status,
            metadata: record.metadata,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          })
        )
        .catch(() => null)
      setStatus(`Loaded P&L: ${parsed.accounts.length} accounts x ${parsed.months.length} months`)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setStatus('')
    }
  }

  async function onPickGL(file: File | null) {
    if (!file) return
    setErr('')
    setStatus('Parsing General Ledger Detail...')
    try {
      const buf = await readFileAsArrayBuffer(file)
      const parsed = parseXeroGeneralLedgerDetail(buf)
      setGL(parsed)
      api
        .createImport({
          name: file.name,
          kind: 'gl',
          status: 'processed',
          metadata: { transactions: parsed.txns.length, source: 'xero' },
        })
        .then((record) =>
          addImport({
            id: record.id,
            name: record.name,
            kind: record.kind,
            status: record.status,
            metadata: record.metadata,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          })
        )
        .catch(() => null)
      setStatus(`Loaded GL: ${parsed.txns.length.toLocaleString()} transactions`)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setStatus('')
    }
  }

  async function connectXero() {
    setErr('')
    try {
      const res = await api.xeroAuthorize()
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function loadTenants() {
    setErr('')
    try {
      const tenants = await api.xeroTenants()
      setXeroTenants(tenants)
      if (!tenants.length) setErr('No Xero tenants found for this account.')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function saveTenantChoice() {
    if (!xeroTenantChoice) return
    setErr('')
    try {
      await api.xeroSelectTenant(xeroTenantChoice)
      await refreshXeroStatus()
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  async function syncFromXero() {
    if (!xeroFromDate || !xeroToDate) {
      setErr('Please enter both From and To dates for the Xero pull.')
      return
    }
    setErr('')
    setStatus('')
    setXeroSyncing(true)
    try {
      const res = await api.xeroSync({ from_date: xeroFromDate, to_date: xeroToDate, include_gl: true })
      if (res.pl) {
        setPL(res.pl)
        api
          .createImport({
            name: `Xero Profit & Loss (${xeroFromDate} → ${xeroToDate})`,
            kind: 'pl',
            status: 'processed',
            metadata: { accounts: res.pl.accounts?.length ?? 0, months: res.pl.months?.length ?? 0, source: 'xero' },
          })
          .then((record) =>
            addImport({
              id: record.id,
              name: record.name,
              kind: record.kind,
              status: record.status,
              metadata: record.metadata,
              createdAt: record.created_at,
              updatedAt: record.updated_at,
            })
          )
          .catch(() => null)
      }
      if (res.gl) {
        setGL(res.gl)
        api
          .createImport({
            name: `Xero GL Detail (${xeroFromDate} → ${xeroToDate})`,
            kind: 'gl',
            status: 'processed',
            metadata: { transactions: res.gl.txns?.length ?? 0, source: 'xero' },
          })
          .then((record) =>
            addImport({
              id: record.id,
              name: record.name,
              kind: record.kind,
              status: record.status,
              metadata: record.metadata,
              createdAt: record.created_at,
              updatedAt: record.updated_at,
            })
          )
          .catch(() => null)
      }
      setStatus('Pulled latest Xero P&L and GL detail.')
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setXeroSyncing(false)
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
        <Button variant="ghost" onClick={() => { setPL(null); setGL(null); setStatus(''); setErr('') }} disabled={disabled}>
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Connect to Xero</div>
            {xeroStatus.connected ? <Chip tone="good">Connected</Chip> : <Chip>Not connected</Chip>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={connectXero} disabled={disabled}>
              Authorize Xero
            </Button>
            <Button variant="ghost" onClick={loadTenants} disabled={disabled || !xeroStatus.connected}>
              Load tenants
            </Button>
            <Button variant="ghost" onClick={refreshXeroStatus} disabled={disabled}>
              Refresh status
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Tenant
              <select
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={xeroTenantChoice}
                onChange={e => setXeroTenantChoice(e.target.value)}
                disabled={disabled || !xeroTenants.length}
              >
                <option value="">{xeroTenants.length ? 'Select a tenant' : 'Load tenants first'}</option>
                {xeroTenants.map(tenant => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs text-slate-400">
              Selected tenant
              <span className="text-sm text-slate-200">{xeroStatus.tenantId || 'Not set'}</span>
            </div>
            <Button
              variant="ghost"
              onClick={saveTenantChoice}
              disabled={disabled || !xeroTenantChoice}
            >
              Use tenant
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              From (YYYY-MM-DD)
              <input
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={xeroFromDate}
                onChange={e => setXeroFromDate(e.target.value)}
                placeholder="2024-07-01"
                disabled={disabled}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              To (YYYY-MM-DD)
              <input
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                value={xeroToDate}
                onChange={e => setXeroToDate(e.target.value)}
                placeholder="2025-06-30"
                disabled={disabled}
              />
            </label>
            <Button onClick={syncFromXero} disabled={disabled || !xeroStatus.connected || !xeroStatus.tenantId || xeroSyncing}>
              {xeroSyncing ? 'Pulling…' : 'Pull P&L + GL'}
            </Button>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            After authorizing, load tenants to pick the organisation you want to sync.
          </div>
        </div>
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
              disabled={disabled}
              onChange={e => onPickPL(e.target.files?.[0] ?? null)}
            />
            <Button className="w-full" onClick={() => plInput.current?.click()} disabled={disabled}>
              <Upload className="h-4 w-4" /> Choose file
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Need a 12-month P&amp;L export?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(xeroProfitLossUrl, '_blank', 'noopener,noreferrer')}
              disabled={disabled}
            >
              Open Xero P&amp;L
            </Button>
          </div>
          {pl && (
            <div className="mt-3 text-xs text-slate-300">
              {pl.accounts.length.toLocaleString()} accounts and {pl.months.length} months
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
              disabled={disabled}
              onChange={e => onPickGL(e.target.files?.[0] ?? null)}
            />
            <Button className="w-full" variant="ghost" onClick={() => glInput.current?.click()} disabled={disabled}>
              <FileText className="h-4 w-4" /> Choose file
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Want drill-down detail?</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(xeroGeneralLedgerUrl, '_blank', 'noopener,noreferrer')}
              disabled={disabled}
            >
              Open Xero GL
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

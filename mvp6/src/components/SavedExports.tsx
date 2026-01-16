import React, { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label, Button, Chip } from './ui'
import { api } from '../lib/api'
import { buildSnapshotSummary, ensureExportSettings, ensureReportConfig, fingerprintGl, fingerprintPl, fingerprintTemplate } from '../lib/snapshotUtils'
import { useAuthStore } from '../store/authStore'

const roles = ['viewer', 'editor', 'admin'] as const

export function SavedExports() {
  const user = useAuthStore(s => s.user)
  const readOnly = user?.role === 'viewer'
  const snapshots = useAppStore(s => s.snapshots)
  const setSnapshots = useAppStore(s => s.setSnapshots)
  const upsertSnapshot = useAppStore(s => s.upsertSnapshot)
  const removeSnapshot = useAppStore(s => s.removeSnapshot)
  const setActiveSnapshotId = useAppStore(s => s.setActiveSnapshotId)
  const setTemplate = useAppStore(s => s.setTemplate)
  const setScenario = useAppStore(s => s.setScenario)
  const setPL = useAppStore(s => s.setPL)
  const setGL = useAppStore(s => s.setGL)
  const setReportConfig = useAppStore(s => s.setReportConfig)
  const setDefaults = useAppStore(s => s.setDefaults)
  const activeSnapshotId = useAppStore(s => s.activeSnapshotId)
  const scenario = useAppStore(s => s.scenario)
  const template = useAppStore(s => s.template)
  const pl = useAppStore(s => s.pl)
  const gl = useAppStore(s => s.gl)
  const defaults = useAppStore(s => s.defaults)
  const reportConfig = useAppStore(s => s.reportConfig)

  const [name, setName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [compareBase, setCompareBase] = useState<string | null>(null)
  const [compareTarget, setCompareTarget] = useState<string | null>(null)
  const [shareSnapshot, setShareSnapshot] = useState<string | null>(null)
  const [shares, setShares] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<typeof roles[number]>('viewer')
  const [shareError, setShareError] = useState<string | null>(null)

  const compareRows = useMemo(() => {
    const base = snapshots.find(s => s.id === compareBase)
    const target = snapshots.find(s => s.id === compareTarget)
    if (!base?.summary || !target?.summary) return []
    return base.summary.kpis.map((kpi: any) => {
      const other = target.summary?.kpis.find((k: any) => k.label === kpi.label)
      const delta = other && kpi.current != null && other.current != null ? other.current - kpi.current : null
      return {
        label: kpi.label,
        base: kpi.current,
        target: other?.current ?? null,
        delta,
      }
    })
  }, [compareBase, compareTarget, snapshots])

  const refreshSnapshots = async () => {
    const list = await api.listSnapshots()
    setSnapshots(
      list.map((snap) => ({
        id: snap.id,
        name: snap.name,
        ownerId: snap.owner_user_id,
        ownerEmail: snap.owner_email,
        role: snap.role,
        createdAt: snap.created_at,
        updatedAt: snap.updated_at,
        summary: snap.summary,
      }))
    )
  }

  const createSnapshot = async () => {
    if (!name.trim()) return
    if (readOnly) return
    const reportCfg = ensureReportConfig(reportConfig)
    const exportSettings = ensureExportSettings(defaults.exportSettings)
    const templateFingerprint = fingerprintTemplate(template)
    const snapshotData = {
      scenario,
      template,
      pl,
      gl,
      reportConfig: reportCfg,
      exportSettings,
      fingerprints: {
        pl: fingerprintPl(pl),
        gl: fingerprintGl(gl),
        templateVersion: templateFingerprint.templateVersion,
        layoutHash: templateFingerprint.layoutHash,
      },
      summary: buildSnapshotSummary({
        pl,
        template,
        scenario,
        reportConfig: reportCfg,
      }),
    }
    const created = await api.createSnapshot({
      name: name.trim(),
      payload: { schema_version: 'v1', data: snapshotData },
    })
    upsertSnapshot({
      id: created.id,
      name: created.name,
      ownerId: created.owner_user_id,
      ownerEmail: created.owner_email,
      role: created.role,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      summary: created.summary ?? snapshotData.summary,
    })
    setActiveSnapshotId(created.id)
    setName('')
    setShowNew(false)
  }

  const loadSnapshot = async (id: string) => {
    const snap = await api.getSnapshot(id)
    const payload = snap.payload?.data
    if (!payload) return
    setScenario(payload.scenario ?? scenario)
    if (payload.template) setTemplate(payload.template, { skipHistory: true, preserveVersion: true, quiet: true })
    setPL(payload.pl ?? null)
    setGL(payload.gl ?? null)
    if (payload.reportConfig) setReportConfig(payload.reportConfig)
    if (payload.exportSettings) setDefaults({ exportSettings: payload.exportSettings })
    setActiveSnapshotId(id)
  }

  const updateSnapshotName = async (id: string) => {
    if (!renameValue.trim()) return
    if (readOnly) return
    const updated = await api.updateSnapshot(id, { name: renameValue.trim() })
    upsertSnapshot({
      id: updated.id,
      name: updated.name,
      ownerId: updated.owner_user_id,
      ownerEmail: updated.owner_email,
      role: updated.role,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      summary: updated.summary,
    })
    setRenameId(null)
  }

  const duplicateSnapshot = async (id: string) => {
    if (readOnly) return
    const dup = await api.duplicateSnapshot(id)
    upsertSnapshot({
      id: dup.id,
      name: dup.name,
      ownerId: dup.owner_user_id,
      ownerEmail: dup.owner_email,
      role: dup.role,
      createdAt: dup.created_at,
      updatedAt: dup.updated_at,
      summary: dup.summary,
    })
  }

  const deleteSnapshot = async (id: string) => {
    if (readOnly) return
    await api.deleteSnapshot(id)
    removeSnapshot(id)
  }

  const openShare = async (id: string) => {
    if (readOnly) return
    setShareSnapshot(id)
    setShareError(null)
    const list = await api.listShares(id)
    setShares(list)
  }

  const invite = async () => {
    if (!shareSnapshot || !inviteEmail.trim()) return
    if (readOnly) return
    try {
      const share = await api.createShare(shareSnapshot, { email: inviteEmail.trim(), role: inviteRole })
      setShares(prev => {
        const rest = prev.filter((s) => s.id !== share.id)
        return [share, ...rest]
      })
      setInviteEmail('')
      setShareError(null)
    } catch (err: any) {
      setShareError(err?.message ?? 'Unable to share')
    }
  }

  const updateShare = async (shareId: string, role: string) => {
    if (!shareSnapshot) return
    if (readOnly) return
    const updated = await api.updateShare(shareSnapshot, shareId, { role })
    setShares(prev => prev.map(s => (s.id === shareId ? updated : s)))
  }

  const removeShare = async (shareId: string) => {
    if (!shareSnapshot) return
    if (readOnly) return
    await api.deleteShare(shareSnapshot, shareId)
    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  const roleBadge = (role: string) => {
    if (role === 'owner') return 'Owner'
    if (role === 'admin') return 'Admin'
    if (role === 'editor') return 'Editor'
    return 'Viewer'
  }

  const canEdit = (role: string) => role === 'owner' || role === 'admin' || role === 'editor'
  const canShare = (role: string) => role === 'owner' || role === 'admin'
  const canDelete = (role: string) => role === 'owner'

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">Snapshots</div>
            <div className="text-xs text-slate-400">Capture the current scenario + uploads as a reusable snapshot.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowNew(prev => !prev)}
              disabled={readOnly}
              title={readOnly ? 'View-only access' : ''}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
            >
              New Snapshot
            </button>
          </div>
        </div>
        {readOnly && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            View-only access enabled. You can open shared snapshots but cannot create or modify them.
          </div>
        )}

        {showNew && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              className="w-56"
              placeholder="Name this snapshot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={createSnapshot} disabled={readOnly}>Save snapshot</Button>
            <Button variant="ghost" onClick={() => { setShowNew(false); setName('') }}>Cancel</Button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {snapshots.length === 0 ? (
            <Card className="p-3 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">No snapshots yet</div>
                  <div className="text-xs text-slate-200">Save your current mapping + uploads to reuse later.</div>
                </div>
                <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Load P&amp;L</Button>
              </div>
            </Card>
          ) : (
            snapshots.map(snap => {
              const isActive = activeSnapshotId === snap.id
              const canEditSnap = !readOnly && canEdit(snap.role)
              const canShareSnap = !readOnly && canShare(snap.role)
              const canDeleteSnap = !readOnly && canDelete(snap.role)
              return (
                <div
                  key={snap.id}
                  className={`flex flex-col gap-3 rounded-xl border px-3 py-3 ${isActive ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-100">{snap.name}</div>
                        {isActive ? <Chip tone="good" className="px-2 py-[2px] text-[10px]">Active</Chip> : null}
                        <Chip className="px-2 py-[2px] text-[10px]">{roleBadge(snap.role)}</Chip>
                      </div>
                      <div className="text-xs text-slate-400">Updated {new Date(snap.updatedAt).toLocaleString()}</div>
                      <div className="text-[11px] text-slate-500">Owner: {snap.ownerEmail}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadSnapshot(snap.id)}
                        className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenameId(snap.id); setRenameValue(snap.name) }}
                        disabled={!canEditSnap}
                        title={canEditSnap ? '' : 'You only have read access'}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 disabled:opacity-50"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateSnapshot(snap.id)}
                        disabled={readOnly}
                        title={readOnly ? 'View-only access' : ''}
                        className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-100"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => openShare(snap.id)}
                        disabled={!canShareSnap}
                        title={canShareSnap ? '' : 'Only owners and admins can share'}
                        className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSnapshot(snap.id)}
                        disabled={!canDeleteSnap}
                        title={canDeleteSnap ? '' : 'Only owners can delete'}
                        className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {renameId === snap.id && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="w-56" />
                      <Button onClick={() => updateSnapshotName(snap.id)}>Save</Button>
                      <Button variant="ghost" onClick={() => setRenameId(null)}>Cancel</Button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" onClick={() => setActiveSnapshotId(null)} disabled={!activeSnapshotId}>Clear active</Button>
          <Button variant="ghost" onClick={refreshSnapshots}>Refresh list</Button>
        </div>
      </Card>

      {snapshots.length >= 2 ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">Compare snapshots</div>
              <div className="text-xs text-slate-400">Quick KPI deltas between any two saved exports.</div>
            </div>
            <Chip className="px-2 py-1 h-7">KPI change</Chip>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <Label>Base</Label>
              <select
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none"
                value={compareBase ?? ''}
                onChange={(e) => setCompareBase(e.target.value || null)}
              >
                <option value="">Select snapshot</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Target</Label>
              <select
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none"
                value={compareTarget ?? ''}
                onChange={(e) => setCompareTarget(e.target.value || null)}
              >
                <option value="">Select snapshot</option>
                {snapshots.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {compareRows.length > 0 ? (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {compareRows.map(row => (
                <div key={row.label} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-200">
                  <div className="font-semibold text-slate-100">{row.label}</div>
                  <div className="flex justify-between text-slate-300">
                    <span>Base</span>
                    <span>{row.base != null ? Math.round(row.base).toLocaleString() : '-'}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Target</span>
                    <span>{row.target != null ? Math.round(row.target).toLocaleString() : '-'}</span>
                  </div>
                  <div className="flex justify-between text-slate-100">
                    <span>Change</span>
                    <span className={row.delta != null && row.delta >= 0 ? 'text-emerald-200' : 'text-rose-200'}>
                      {row.delta != null ? Math.round(row.delta).toLocaleString() : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-300">Select two snapshots to see KPI movement.</div>
          )}
        </Card>
      ) : null}

      {shareSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <Card className="w-full max-w-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Share snapshot</div>
                <div className="text-xs text-slate-400">Invite teammates and set roles.</div>
              </div>
              <button
                type="button"
                onClick={() => setShareSnapshot(null)}
                className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr,140px,auto]">
              <div>
                <Label>Email</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={invite} disabled={readOnly}>Invite</Button>
              </div>
            </div>

            {shareError && <div className="mt-3 text-xs text-rose-200">{shareError}</div>}

            <div className="mt-4 space-y-2">
              {shares.map(share => (
                <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  <div>
                    <div className="font-semibold text-slate-100">{share.user_email}</div>
                    <div className="text-[11px] text-slate-400">{share.role}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                      value={share.role}
                      onChange={(e) => updateShare(share.id, e.target.value)}
                      disabled={readOnly}
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <Button variant="ghost" onClick={() => removeShare(share.id)} disabled={readOnly}>Remove</Button>
                  </div>
                </div>
              ))}
              {shares.length === 0 && <div className="text-xs text-slate-400">No shared users yet.</div>}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Card, Input, Label, Chip, Button } from './ui'
import { RECOMMENDED_DEFAULTS } from '../lib/defaults'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { PageHeader } from './PageHeader'

export function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const isReadOnly = user?.role === 'viewer'
  const isSuperAdmin = user?.role === 'super_admin'
  const defaults = useAppStore(s => s.defaults)
  const setDefaults = useAppStore(s => s.setDefaults)
  const resetDefaults = useAppStore(s => s.resetDefaults)
  const [localDefaults, setLocalDefaults] = useState(defaults)
  const [savedState, setSavedState] = useState<'idle' | 'saved'>('idle')
  const [users, setUsers] = useState<{ id: string; email: string; role: string; created_at: string }[]>([])
  const [usersError, setUsersError] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountStatus, setAccountStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [accountError, setAccountError] = useState<string | null>(null)

  useEffect(() => {
    setLocalDefaults(defaults)
  }, [defaults])

  useEffect(() => {
    setAccountEmail(user?.email ?? '')
  }, [user?.email])

  useEffect(() => {
    if (!isSuperAdmin) return
    api
      .listUsers()
      .then(setUsers)
      .catch((err: any) => setUsersError(err?.message ?? 'Unable to load users'))
  }, [isSuperAdmin])

  const updateState = (state: 'NSW/QLD' | 'WA' | 'VIC', field: 'suggestedCbaPrice' | 'suggestedProgramPrice' | 'mriCostByState' | 'mriPatientByState', val: number) => {
    setLocalDefaults(prev => ({
      ...prev,
      [field]: { ...prev[field], [state]: val },
    }))
  }

  const save = () => {
    setDefaults(localDefaults)
    setSavedState('saved')
    setTimeout(() => setSavedState('idle'), 1500)
  }

  const reset = () => {
    setLocalDefaults(RECOMMENDED_DEFAULTS)
    resetDefaults()
    setSavedState('saved')
    setTimeout(() => setSavedState('idle'), 1500)
  }

  const canSaveAccount = useMemo(() => {
    if (!user) return false
    if (newPassword && newPassword !== confirmPassword) return false
    const emailChanged = accountEmail.trim() && accountEmail.trim() !== user.email
    const passwordChanged = Boolean(newPassword.trim())
    return Boolean(emailChanged || passwordChanged)
  }, [accountEmail, confirmPassword, newPassword, user])

  const saveAccount = async () => {
    if (!user) return
    if (newPassword && newPassword !== confirmPassword) {
      setAccountError('New passwords do not match.')
      setAccountStatus('error')
      return
    }
    if (newPassword && !currentPassword) {
      setAccountError('Enter your current password to change it.')
      setAccountStatus('error')
      return
    }
    setAccountStatus('saving')
    setAccountError(null)
    try {
      const payload: { email?: string; current_password?: string; new_password?: string } = {}
      if (accountEmail.trim() && accountEmail.trim() !== user.email) payload.email = accountEmail.trim()
      if (newPassword.trim()) {
        payload.current_password = currentPassword
        payload.new_password = newPassword.trim()
      }
      const res = await api.updateAccount(payload)
      setUser(res.user)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setAccountStatus('saved')
      setTimeout(() => setAccountStatus('idle'), 2000)
    } catch (err: any) {
      setAccountError(err?.message ?? 'Unable to update account.')
      setAccountStatus('error')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Settings"
        subtitle="Manage account access and defaults."
        actions={
          savedState === 'saved' ? <Chip tone="good">Saved</Chip> : <Chip tone="neutral">Changes pending</Chip>
        }
      />
      <Card className="p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-100">Account</div>
          <div className="text-xs text-slate-400">Manage your sign-in details.</div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Email</Label>
            <Input
              className="mt-1"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <Label>Current password</Label>
            <Input
              className="mt-1"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Required for password changes"
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input
              className="mt-1"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input
              className="mt-1"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <Button onClick={saveAccount} disabled={!canSaveAccount || accountStatus === 'saving'}>
            {accountStatus === 'saving' ? 'Saving...' : 'Save account changes'}
          </Button>
          {accountStatus === 'saved' && <span className="text-emerald-200">Account updated.</span>}
          {accountStatus === 'error' && accountError && <span className="text-rose-200">{accountError}</span>}
          {!accountError && newPassword && newPassword !== confirmPassword && (
            <span className="text-amber-200">Passwords must match.</span>
          )}
        </div>
      </Card>
      <Card className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">Pricing by state</div>
            <div className="text-xs text-slate-400">Suggests bundle prices + MRI defaults when you switch state in the scenario.</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={isReadOnly}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Reset to recommended
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isReadOnly}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
        {isReadOnly && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            View-only access enabled. Settings changes are disabled.
          </div>
        )}

        <div className={`grid grid-cols-1 gap-3 lg:grid-cols-3 ${isReadOnly ? 'pointer-events-none opacity-70' : ''}`}>
          {(['NSW/QLD', 'WA', 'VIC'] as const).map(state => (
            <div key={state} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>{state}</span>
                <Chip className="px-2 py-0.5 h-6">{state === 'WA' ? 'Premium' : 'Baseline'}</Chip>
              </div>
              <div>
                <Label>CBA price</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.suggestedCbaPrice[state]}
                  onChange={(e) => updateState(state, 'suggestedCbaPrice', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Program price</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.suggestedProgramPrice[state]}
                  onChange={(e) => updateState(state, 'suggestedProgramPrice', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>MRI cost (your cost)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.mriCostByState[state]}
                  onChange={(e) => updateState(state, 'mriCostByState', Number(e.target.value))}
                />
              </div>
              <div>
                <Label>MRI patient fee</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={localDefaults.mriPatientByState[state]}
                  onChange={(e) => updateState(state, 'mriPatientByState', Number(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={`grid grid-cols-1 gap-3 md:grid-cols-3 ${isReadOnly ? 'pointer-events-none opacity-70' : ''}`}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold text-slate-100">Global defaults</div>
            <div className="text-xs text-slate-400">Used everywhere for doctor payouts.</div>
            <div className="mt-3">
              <Label>Doctor service fee retained (%)</Label>
              <Input
                className="mt-1"
                type="number"
                value={localDefaults.doctorServiceFeePct}
                onChange={(e) => setLocalDefaults({ ...localDefaults, doctorServiceFeePct: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Export settings</div>
                <div className="text-xs text-slate-400">Controls PDF size + margins for Saved Exports and Reports.</div>
              </div>
              <Chip className="px-2 py-1 h-7">Page layout</Chip>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Page size</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['a4', 'letter'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setLocalDefaults({ ...localDefaults, exportSettings: { ...localDefaults.exportSettings, pageSize: size } })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        localDefaults.exportSettings.pageSize === size
                          ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {size === 'a4' ? 'A4' : 'Letter'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Margins (mm)</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min={4}
                  value={localDefaults.exportSettings.marginMm}
                  onChange={(e) =>
                    setLocalDefaults({
                      ...localDefaults,
                      exportSettings: { ...localDefaults.exportSettings, marginMm: Number(e.target.value) },
                    })
                  }
                />
                <div className="mt-1 text-[11px] text-slate-400">Clamped between 4mm and 1/3 of the page width.</div>
              </div>
              <div className="rounded-xl border border-indigo-400/10 bg-indigo-500/5 px-3 py-2 text-xs text-slate-200">
                <div className="font-semibold text-slate-100">Recommended</div>
                <div>A4 with 12mm margins keeps the preview flush with investor PDF output.</div>
              </div>
            </div>
          </div>
        </div>

        {savedState === 'saved' ? (
          <div className="text-xs text-emerald-200">Saved. Future scenarios, exports, and reports will use these defaults.</div>
        ) : null}
      </Card>

      {isSuperAdmin && (
        <Card className="p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">User access</div>
            <div className="text-xs text-slate-400">Control who can edit vs view. New users default to viewer.</div>
          </div>
          {usersError && <div className="text-xs text-rose-200">{usersError}</div>}
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <div>
                  <div className="font-semibold text-slate-100">{u.email}</div>
                  <div className="text-[11px] text-slate-400">Created {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100"
                  value={u.role}
                  onChange={async (e) => {
                    const nextRole = e.target.value
                    const updated = await api.updateUserRole(u.id, { role: nextRole })
                    setUsers(prev => prev.map(item => (item.id === u.id ? updated : item)))
                  }}
                >
                  {['viewer', 'editor', 'admin', 'super_admin'].map(role => (
                    <option key={role} value={role}>{role.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            ))}
            {users.length === 0 && !usersError && <div className="text-xs text-slate-400">No users found yet.</div>}
          </div>
        </Card>
      )}
    </div>
  )
}

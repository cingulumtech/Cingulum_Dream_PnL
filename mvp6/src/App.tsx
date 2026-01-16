import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, FileSpreadsheet, LayoutGrid, HelpCircle, Wand2, Settings, Database, FileText, Settings2, User } from 'lucide-react'
import { useAppStore, type View } from './store/appStore'
import { UploadPanel } from './components/UploadPanel'
import { Overview } from './components/Overview'
import { LegacyPnLTable } from './components/LegacyPnLTable'
import { DreamPnLTable } from './components/DreamPnLTable'
import { MappingEditor } from './components/MappingEditor'
import { TemplateEditor } from './components/TemplateEditor'
import { Help } from './components/Help'
import { SettingsPage } from './components/SettingsPage'
import { SavedExports } from './components/SavedExports'
import { Reports } from './components/Reports'
import { DrilldownDrawer } from './components/DrilldownDrawer'
import { Card } from './components/ui'
import { AppMark } from './components/AppMark'
import { AuthGate } from './components/AuthGate'
import { api } from './lib/api'
import { useAuthStore } from './store/authStore'
import { ServerSync } from './components/ServerSync'

export function App() {
  const view = useAppStore(s => s.view)
  const setView = useAppStore(s => s.setView)
  const setTemplate = useAppStore(s => s.setTemplate)
  const setReportConfig = useAppStore(s => s.setReportConfig)
  const setDefaults = useAppStore(s => s.setDefaults)
  const setSnapshots = useAppStore(s => s.setSnapshots)
  const setImports = useAppStore(s => s.setImports)
  const setHydrated = useAppStore(s => s.setHydrated)
  const setTemplateSaveStatus = useAppStore(s => s.setTemplateSaveStatus)
  const setReportSaveStatus = useAppStore(s => s.setReportSaveStatus)
  const setSettingsSaveStatus = useAppStore(s => s.setSettingsSaveStatus)

  const { user, status, setUser, setStatus } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAuthed = status === 'authenticated'
  const isReadOnly = !!user && user.role === 'viewer'

  const loadState = useCallback(async () => {
    const data = await api.getState()
    if (data?.template?.data) {
      setTemplate(data.template.data, { skipHistory: true, preserveVersion: true, quiet: true })
    }
    if (data?.report?.data) {
      setReportConfig(data.report.data)
    }
    if (data?.settings?.data) {
      setDefaults(data.settings.data)
    }
    if (Array.isArray(data?.snapshots)) {
      setSnapshots(
        data.snapshots.map((snap: any) => ({
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
    if (Array.isArray(data?.imports)) {
      setImports(
        data.imports.map((item: any) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
          status: item.status,
          metadata: item.metadata,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }))
      )
    }
    setHydrated(true)
    setTemplateSaveStatus('saved')
    setReportSaveStatus('saved')
    setSettingsSaveStatus('saved')
  }, [setTemplate, setReportConfig, setDefaults, setSnapshots, setImports, setHydrated, setTemplateSaveStatus, setReportSaveStatus, setSettingsSaveStatus])

  useEffect(() => {
    const boot = async () => {
      try {
        const res = await api.me()
        setUser(res.user)
        setStatus('authenticated')
        await loadState()
      } catch {
        setStatus('unauthenticated')
      }
    }
    boot()
  }, [loadState, setStatus, setUser])

  const onSignOut = async () => {
    await api.logout().catch(() => null)
    setUser(null)
    setStatus('unauthenticated')
    setHydrated(false)
  }

  const nav: { id: View; label: string; icon: React.ComponentType<any> }[] = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'pnlLegacy', label: 'Legacy P&L', icon: FileSpreadsheet },
      { id: 'pnlManagement', label: 'Atlas P&L', icon: LayoutGrid },
      { id: 'mapping', label: 'Mapping', icon: Wand2 },
      { id: 'layout', label: 'Layout', icon: Settings2 },
      { id: 'reports', label: 'Reports', icon: FileText },
      { id: 'snapshots', label: 'Snapshots', icon: Database },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help', icon: HelpCircle },
    ],
    []
  )

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 700px at 8% 0%, rgba(64,145,106,0.24), transparent 60%), radial-gradient(900px 620px at 92% 12%, rgba(82,183,136,0.16), transparent 55%), rgb(var(--color-canvas))',
        }}
      />
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px,minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="p-4">
              <AppMark
                layout="stacked"
                caption="Accounting Atlas turns your mapped Xero exports into a board-grade story for Cingulum Health."
              />
              {user && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-slate-100">
                        {user.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-300">{user.email}</div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpen(prev => !prev)}
                        className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-200"
                      >
                        <User className="h-3 w-3" /> Account
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-1 text-xs text-slate-200 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setView('settings')
                              setMenuOpen(false)
                            }}
                            className="w-full rounded-lg px-2 py-2 text-left hover:bg-white/10"
                          >
                            Account settings
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false)
                              onSignOut()
                            }}
                            className="w-full rounded-lg px-2 py-2 text-left hover:bg-white/10"
                          >
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-3">
              <div className="flex flex-col gap-1">
                {nav.map(item => {
                  const Icon = item.icon
                  const active = view === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => isAuthed && setView(item.id as any)}
                      disabled={!isAuthed}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed ${
                        active ? 'bg-indigo-500/15 border-indigo-400/30 text-slate-50' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10 text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-200" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </Card>

            <UploadPanel disabled={!isAuthed || isReadOnly} />
          </div>

          <div className="space-y-4 min-w-0">
            {!isAuthed ? (
              <AuthGate onAuthenticated={loadState} />
            ) : (
              <>
                {view === 'overview' && <Overview />}
                {view === 'pnlLegacy' && <LegacyPnLTable />}
                {view === 'pnlManagement' && <DreamPnLTable />}
                {view === 'mapping' && <MappingEditor />}
                {view === 'layout' && <TemplateEditor />}
                {view === 'settings' && <SettingsPage />}
                {view === 'snapshots' && <SavedExports />}
                {view === 'reports' && <Reports />}
                {view === 'help' && <Help />}
              </>
            )}
          </div>
        </div>
      </div>

      {isAuthed && <ServerSync />}
      <DrilldownDrawer />
    </div>
  )
}

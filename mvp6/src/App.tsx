import React from 'react'
import { BarChart3, FileSpreadsheet, LayoutGrid, HelpCircle, Wand2, Settings, Database, FileText, Settings2 } from 'lucide-react'
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

export function App() {
  const view = useAppStore(s => s.view)
  const setView = useAppStore(s => s.setView)

  const nav: { id: View; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pnlLegacy', label: 'P&L (Legacy)', icon: FileSpreadsheet },
    { id: 'pnlManagement', label: 'P&L (Management)', icon: LayoutGrid },
    { id: 'mapping', label: 'Mapping', icon: Wand2 },
    { id: 'layout', label: 'Layout', icon: Settings2 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'snapshots', label: 'Snapshots', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Single background layer (prevents visible seams / splits) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 700px at 10% 0%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(900px 600px at 90% 20%, rgba(56,189,248,0.20), transparent 55%), rgb(17,24,39)',
        }}
      />
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px,1fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 via-sky-400 to-cyan-300 text-slate-900 font-black shadow-glass ring-1 ring-white/40">
                  C
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-200">Cingulum</div>
                  <div className="text-lg font-semibold">P&amp;L Control</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Upload Xero exports, map once, and drive a board-grade P&amp;L with drill-down.
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex flex-col gap-1">
                {nav.map(item => {
                  const Icon = item.icon
                  const active = view === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                        active ? 'bg-indigo-500/15 border-indigo-400/30' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-200" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </Card>

            <UploadPanel />
          </div>

          <div className="space-y-4">
            {view === 'overview' && <Overview />}
            {view === 'pnlLegacy' && <LegacyPnLTable />}
            {view === 'pnlManagement' && <DreamPnLTable />}
            {view === 'mapping' && <MappingEditor />}
            {view === 'layout' && <TemplateEditor />}
            {view === 'settings' && <SettingsPage />}
            {view === 'snapshots' && <SavedExports />}
            {view === 'reports' && <Reports />}
            {view === 'help' && <Help />}
          </div>
        </div>
      </div>

      <DrilldownDrawer />
    </div>
  )
}

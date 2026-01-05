import React from 'react'
import { BarChart3, FileSpreadsheet, LayoutGrid, HelpCircle, Wand2, Settings, Database, FileText } from 'lucide-react'
import { useAppStore } from './store/appStore'
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

export function App() {
  const view = useAppStore(s => s.view)
  const setView = useAppStore(s => s.setView)

  const nav = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'legacy', label: 'Legacy P&L', icon: FileSpreadsheet },
    { id: 'dream', label: 'Atlas P&L', icon: LayoutGrid },
    { id: 'mapping', label: 'Mapping', icon: Wand2 },
    { id: 'scenario', label: 'Layout editor', icon: Settings },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'exports', label: 'Saved Exports', icon: Database },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ] as const

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Single background layer (prevents visible seams / splits) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 700px at 8% 0%, rgba(64,145,106,0.24), transparent 60%), radial-gradient(900px 620px at 92% 12%, rgba(82,183,136,0.16), transparent 55%), rgb(var(--color-canvas))',
        }}
      />
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px,1fr]">
          <div className="space-y-4">
            <Card className="p-4">
              <AppMark
                layout="stacked"
                caption="Accounting Atlas turns your mapped Xero exports into a board-grade story for Cingulum Health."
              />
            </Card>

            <Card className="p-3">
              <div className="flex flex-col gap-1">
                {nav.map(item => {
                  const Icon = item.icon
                  const active = view === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id as any)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
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

            <UploadPanel />
          </div>

          <div className="space-y-4">
            {view === 'overview' && <Overview />}
            {view === 'legacy' && <LegacyPnLTable />}
            {view === 'dream' && <DreamPnLTable />}
            {view === 'mapping' && <MappingEditor />}
            {view === 'scenario' && <TemplateEditor />}
            {view === 'settings' && <SettingsPage />}
            {view === 'exports' && <SavedExports />}
            {view === 'reports' && <Reports />}
            {view === 'help' && <Help />}
          </div>
        </div>
      </div>

      <DrilldownDrawer />
    </div>
  )
}

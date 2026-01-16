import React, { useMemo, useState, useEffect } from 'react'
import { Check, ChevronRight, GripVertical, MousePointer2, Search, Undo2, Wand2 } from 'lucide-react'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { computeDream } from '../lib/dream/compute'
import { DreamLine, XeroPLSection } from '../lib/types'
import { setLineMappings } from '../lib/dream/edit'
import { flattenLines } from '../lib/dream/schema'
import { Button, Card, Chip, Input, Label } from './ui'
import { SaveStatusPill } from './SaveStatus'
import { PageHeader } from './PageHeader'
import { motion, useReducedMotion } from 'framer-motion'

type AccountRow = { name: string; section: XeroPLSection; total?: number }

type SavedView = {
  name: string
  qLine: string
  qAcc: string
  accountFilter: string
  tokens: string[]
}

const SECTION_LABEL: Record<XeroPLSection, string> = {
  trading_income: 'Revenue',
  other_income: 'Revenue',
  cost_of_sales: 'COGS',
  operating_expenses: 'OpEx',
  unknown: 'Other',
}

const sectionFilterDefs = [
  { id: 'unmapped', label: 'Unmapped' },
  { id: 'mapped', label: 'Mapped' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expense', label: 'Expenses' },
  { id: 'all', label: 'All accounts' },
] as const

function DraggableHandle({ listeners, attributes }: { listeners: any; attributes: any }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-300 cursor-grab select-none"
      {...listeners}
      {...attributes}
      aria-label="Drag"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )
}

function DraggableAccount({ account, active, onToggle }: { account: AccountRow; active: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `acc:${account.name}`,
    data: { account: account.name },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm border transition ${
        active
          ? 'bg-indigo-500/20 border-indigo-400/40 ring-1 ring-indigo-400/30'
          : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
      } ${isDragging ? 'opacity-60 shadow-lift' : ''}`}
      onClick={onToggle}
    >
      <div className="min-w-0">
        <div className="font-semibold text-slate-100 truncate">{account.name}</div>
        <div className="text-xs text-slate-400">{SECTION_LABEL[account.section]}</div>
      </div>
      <DraggableHandle listeners={listeners} attributes={attributes} />
    </div>
  )
}

function DroppableLine({
  line,
  selected,
  activeDrop,
  onSelect,
  children,
}: {
  line: DreamLine
  selected: boolean
  activeDrop: boolean
  onSelect: () => void
  children?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `line:${line.id}` })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={setNodeRef}
      onClick={onSelect}
      initial={false}
      animate={{ scale: isOver ? 1.01 : 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border transition ${
        selected
          ? 'bg-indigo-500/20 border-indigo-400/40 ring-1 ring-indigo-400/30'
          : activeDrop || isOver
            ? 'bg-indigo-500/15 border-indigo-400/30'
            : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
      }`}
    >
      {children}
    </motion.div>
  )
}

export function MappingEditor() {
  const user = useAuthStore(s => s.user)
  const readOnly = user?.role === 'viewer'
  const pl = useAppStore(s => s.pl)
  const template = useAppStore(s => s.template)
  const setTemplate = useAppStore(s => s.setTemplate)
  const undoTemplate = useAppStore(s => s.undoTemplate)
  const canUndo = useAppStore(s => s.canUndo())
  const templateSaveStatus = useAppStore(s => s.templateSaveStatus)

  const [selectedLineId, setSelectedLineIdLocal] = useState<string | null>(null)
  const [qLine, setQLine] = useState('')
  const [qAcc, setQAcc] = useState('')
  const [accountFilter, setAccountFilter] = useState<(typeof sectionFilterDefs)[number]['id']>('unmapped')
  const [activeTokens, setActiveTokens] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [activeDragAccount, setActiveDragAccount] = useState<string | null>(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [viewName, setViewName] = useState('')

  const lines = useMemo(() => flattenLines(template.root), [template])
  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])

  const selectedLine = useMemo(() => lines.find(l => l.id === selectedLineId) ?? null, [lines, selectedLineId])

  const accounts = useMemo<AccountRow[]>(() => {
    if (!pl) return []
    return [...pl.accounts]
      .map(a => ({ name: a.name, section: a.section, total: a.total }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [pl])

  const mappedSet = useMemo(() => {
    const s = new Set<string>()
    for (const ln of lines) for (const a of ln.mappedAccounts) s.add(a)
    return s
  }, [lines])

  const unmappedAccounts = useMemo(() => accounts.filter(a => !mappedSet.has(a.name)), [accounts, mappedSet])

  const sectionStats = useMemo(() => {
    const bucket = {
      revenue: accounts.filter(a => a.section === 'trading_income' || a.section === 'other_income'),
      cogs: accounts.filter(a => a.section === 'cost_of_sales'),
      opex: accounts.filter(a => a.section === 'operating_expenses'),
    }
    return [
      { id: 'revenue', label: 'Revenue', total: bucket.revenue.length, mapped: bucket.revenue.filter(a => mappedSet.has(a.name)).length },
      { id: 'cogs', label: 'Cost of Sales', total: bucket.cogs.length, mapped: bucket.cogs.filter(a => mappedSet.has(a.name)).length },
      { id: 'opex', label: 'OpEx', total: bucket.opex.length, mapped: bucket.opex.filter(a => mappedSet.has(a.name)).length },
    ].map(s => ({ ...s, percent: s.total ? Math.round((s.mapped / s.total) * 100) : 0 }))
  }, [accounts, mappedSet])

  const filteredLines = useMemo(() => {
    const needle = qLine.toLowerCase()
    return lines.filter(l => !needle || l.label.toLowerCase().includes(needle))
  }, [lines, qLine])

  const suggestedTokens = useMemo(() => {
    const counts = new Map<string, number>()
    for (const account of accounts) {
      const tokens = account.name
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(t => t.length >= 3)
      tokens.forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1))
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([token, count]) => ({ token, count }))
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    const needle = qAcc.toLowerCase()
    return accounts
      .filter(a => {
        if (accountFilter === 'unmapped') return !mappedSet.has(a.name)
        if (accountFilter === 'mapped') return mappedSet.has(a.name)
        if (accountFilter === 'revenue') return a.section === 'trading_income' || a.section === 'other_income'
        if (accountFilter === 'expense') return a.section === 'cost_of_sales' || a.section === 'operating_expenses'
        return true
      })
      .filter(a => !needle || a.name.toLowerCase().includes(needle))
      .filter(a => activeTokens.length === 0 || activeTokens.every(token => a.name.toLowerCase().includes(token)))
  }, [accounts, qAcc, accountFilter, mappedSet, activeTokens])

  const selectionPreview = useMemo(() => {
    const items = accounts.filter(a => selectedAccounts.has(a.name))
    const total = items.reduce((sum, item) => sum + Math.abs(item.total ?? 0), 0)
    return { items, total }
  }, [accounts, selectedAccounts])

  useEffect(() => {
    const raw = window.localStorage.getItem('atlas-mapping-views')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as SavedView[]
      setSavedViews(parsed)
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('atlas-mapping-views', JSON.stringify(savedViews))
  }, [savedViews])

  if (!pl) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Mapping"
          subtitle="Import the Profit & Loss export to start mapping Xero accounts."
          actions={
            <>
              <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&amp;L</Button>
              <Button variant="secondary" onClick={() => document.getElementById('gl-upload-input')?.click()}>Upload GL (optional)</Button>
            </>
          }
        />
        <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
          <div className="text-sm text-slate-200">Upload a P&amp;L to unlock mapping.</div>
        </Card>
      </div>
    )
  }

  function setMappings(line: DreamLine, mappedAccounts: string[]) {
    setTemplate(setLineMappings(template, line.id, mappedAccounts), { preserveVersion: false })
  }

  function toggleAccount(line: DreamLine, acc: string) {
    const existing = new Set(line.mappedAccounts)
    if (existing.has(acc)) existing.delete(acc)
    else existing.add(acc)
    setMappings(line, Array.from(existing).sort((a, b) => a.localeCompare(b)))
  }

  function mapAccountToLine(lineId: string, acc: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    if (line.mappedAccounts.includes(acc)) return
    setMappings(line, [...line.mappedAccounts, acc])
    setSelectedLineIdLocal(lineId)
  }

  function removeAccountFromLine(line: DreamLine, acc: string) {
    if (!line.mappedAccounts.includes(acc)) return
    setMappings(
      line,
      line.mappedAccounts
        .filter(a => a !== acc)
        .sort((a, b) => a.localeCompare(b))
    )
  }

  function autoSuggest() {
    if (!selectedLine) return
    const scored = unmappedAccounts
      .map(a => ({ a: a.name, s: scoreSuggestion(selectedLine.label, a.name) }))
      .filter(x => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 10)
      .map(x => x.a)
    if (!scored.length) return
    const merged = Array.from(new Set([...selectedLine.mappedAccounts, ...scored]))
    setMappings(selectedLine, merged)
  }

  function applySelectionRule() {
    if (!selectedLine || selectionPreview.items.length === 0) return
    const merged = Array.from(new Set([...selectedLine.mappedAccounts, ...selectionPreview.items.map(m => m.name)]))
    setMappings(selectedLine, merged)
    setSelectedAccounts(new Set())
    setConfirmApply(false)
  }

  function handleDragStart(event: DragStartEvent) {
    const account = event.active.data.current?.account as string | undefined
    setActiveDragAccount(account ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const account = event.active.data.current?.account as string | undefined
    const overId = event.over?.id?.toString() ?? null
    if (!account || !overId) {
      setActiveDragAccount(null)
      return
    }
    if (overId.startsWith('line:')) {
      mapAccountToLine(overId.replace('line:', ''), account)
    }
    if (overId === 'unassign' && selectedLine) {
      removeAccountFromLine(selectedLine, account)
    }
    setActiveDragAccount(null)
  }

  const selectedView = savedViews.find(v => v.name === viewName)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mapping"
        subtitle="Assign Xero accounts to your management layout. Unmapped accounts are highlighted by default."
        actions={
          <>
            <Chip>{unmappedAccounts.length} unmapped accounts</Chip>
            <SaveStatusPill status={templateSaveStatus} />
          </>
        }
      />
      <Card className="p-5 overflow-hidden">
      {readOnly && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          View-only access enabled. Contact an admin to unlock editing.
        </div>
      )}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={`mt-5 grid grid-cols-1 gap-4 md:grid-cols-[420px,minmax(0,1fr)] ${readOnly ? 'pointer-events-none opacity-70' : ''}`}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-300" />
            <Input value={qLine} onChange={e => setQLine(e.target.value)} placeholder="Search layout lines" />
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
            <MousePointer2 className="h-3 w-3" />
            Drag accounts from the right or use the selection rule builder.
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto pr-1 space-y-1">
            {filteredLines.map(l => (
              <DroppableLine
                key={l.id}
                line={l}
                selected={selectedLineId === l.id}
                activeDrop={activeDragAccount != null}
                onSelect={() => setSelectedLineIdLocal(l.id)}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{l.label}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    {l.mappedAccounts.length ? `${l.mappedAccounts.length} mapped` : 'Unmapped'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </DroppableLine>
            ))}
          </div>
          </div>

          <div className="space-y-4 min-w-0">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
              {!selectedLine ? (
                <div className="text-sm text-slate-300">Select a layout line to map accounts.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{selectedLine.label}</div>
                        <div className="text-xs text-slate-400">Tap accounts to toggle. Drag handles enable drag and drop.</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={autoSuggest}>
                        <Wand2 className="h-3.5 w-3.5" /> Auto suggest
                      </Button>
                    </div>

                    <div>
                      <Label>Mapped accounts</Label>
                      <div
                        className="mt-2 flex flex-wrap gap-2 min-h-[48px] rounded-xl border px-2 py-2 transition border-white/10 bg-black/20"
                      >
                        <UnassignDropZone selectedLine={selectedLine} />
                        {selectedLine.mappedAccounts.length === 0 && <Chip>Drop accounts to map</Chip>}
                        {selectedLine.mappedAccounts.map(a => (
                          <MappedChip key={a} label={a} onRemove={() => toggleAccount(selectedLine, a)} />
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                        <MousePointer2 className="h-3 w-3" />
                        Drag chips to the drop zone to unassign.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">Teach by example</div>
                          <div className="text-xs text-slate-300 mt-1">
                            Select accounts below, preview the impact, then confirm to map them to this line.
                          </div>
                        </div>
                        <Chip>{selectedAccounts.size} selected</Chip>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmApply(true)}
                          disabled={!selectedAccounts.size}
                        >
                          Preview selection
                        </Button>
                        {confirmApply && (
                          <>
                            <span className="text-slate-400">
                              {selectionPreview.items.length} accounts and {selectionPreview.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total activity
                            </span>
                            <Button variant="primary" size="sm" onClick={applySelectionRule}>
                              Confirm mapping
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmApply(false)}>
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                      {computed && selectedLine && (
                        <div className="mt-2 text-xs text-slate-400">
                          Line total preview: {(computed.byLineId[selectedLine.id]?.reduce((a, b) => a + b, 0) ?? 0).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {sectionFilterDefs.map(def => (
                  <Chip
                    key={def.id}
                    className={`cursor-pointer ${accountFilter === def.id ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                    onClick={() => setAccountFilter(def.id)}
                  >
                    {def.label}
                  </Chip>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <Search className="h-4 w-4 text-slate-300" />
                  <Input
                    value={qAcc}
                    onChange={e => setQAcc(e.target.value)}
                    placeholder="Search Xero accounts"
                    className="w-64"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Suggested tokens:</span>
                {suggestedTokens.map(token => (
                  <Chip
                    key={token.token}
                    className={`cursor-pointer ${activeTokens.includes(token.token) ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                    onClick={() =>
                      setActiveTokens(prev =>
                        prev.includes(token.token) ? prev.filter(t => t !== token.token) : [...prev, token.token]
                      )
                    }
                  >
                    {token.token} ({token.count})
                  </Chip>
                ))}
                {activeTokens.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setActiveTokens([])}>
                    Clear tokens
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Label>Saved views</Label>
                <select
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                  value={selectedView?.name ?? ''}
                  onChange={(e) => {
                    const view = savedViews.find(v => v.name === e.target.value)
                    if (!view) return
                    setQLine(view.qLine)
                    setQAcc(view.qAcc)
                    setAccountFilter(view.accountFilter as any)
                    setActiveTokens(view.tokens)
                    setViewName(view.name)
                  }}
                >
                  <option value="">Select view</option>
                  {savedViews.map(view => (
                    <option key={view.name} value={view.name}>{view.name}</option>
                  ))}
                </select>
                <Input
                  className="w-40"
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                  placeholder="Name view"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!viewName.trim()) return
                    const next = savedViews.filter(v => v.name !== viewName.trim())
                    next.push({ name: viewName.trim(), qLine, qAcc, accountFilter, tokens: activeTokens })
                    setSavedViews(next)
                  }}
                >
                  Save view
                </Button>
                {selectedView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSavedViews(savedViews.filter(v => v.name !== selectedView.name))}
                  >
                    Delete view
                  </Button>
                )}
              </div>

              <div className="mt-3 max-h-[360px] overflow-auto pr-1 space-y-2">
                {filteredAccounts.map(a => {
                  const active = selectedLine?.mappedAccounts.includes(a.name)
                  return (
                    <div key={a.name} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedAccounts.has(a.name)}
                        onChange={() =>
                          setSelectedAccounts(prev => {
                            const next = new Set(prev)
                            if (next.has(a.name)) next.delete(a.name)
                            else next.add(a.name)
                            return next
                          })
                        }
                      />
                      <DraggableAccount account={a} active={!!active} onToggle={() => selectedLine && toggleAccount(selectedLine, a.name)} />
                    </div>
                  )
                })}
                {filteredAccounts.length === 0 && <div className="text-sm text-slate-400 mt-2">No accounts match this filter.</div>}
              </div>
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeDragAccount ? (
            <div className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-sm shadow-lift">
              {activeDragAccount}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <Button variant="ghost" size="sm" onClick={undoTemplate} disabled={!canUndo}>
          <Undo2 className="h-3.5 w-3.5" /> Undo last mapping
        </Button>
        <div className="flex gap-2">
          {sectionStats.map(stat => (
            <Chip key={stat.id} tone={stat.percent === 100 ? 'good' : 'neutral'}>
              {stat.label} {stat.percent}% mapped
            </Chip>
          ))}
        </div>
      </div>
    </Card>
    </div>
  )
}

function UnassignDropZone({ selectedLine }: { selectedLine: DreamLine }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassign' })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
        isOver ? 'border-rose-400/40 bg-rose-500/20 text-rose-100' : 'border-white/10 bg-white/5 text-slate-300'
      }`}
    >
      Drop here to unassign
      {isOver && selectedLine.mappedAccounts.length > 0 && (
        <span className="text-[11px]">Release to remove</span>
      )}
    </div>
  )
}

function MappedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mapped:${label}`,
    data: { account: label },
  })

  return (
    <div
      ref={setNodeRef}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
        isDragging ? 'opacity-60 shadow-lift' : 'bg-white/5 text-slate-200 border-white/10'
      }`}
    >
      <button
        type="button"
        className="text-slate-200 hover:text-white"
        onClick={onRemove}
        title="Remove"
      >
        <Check className="h-3 w-3" />
      </button>
      <span className="text-slate-100">{label}</span>
      <DraggableHandle listeners={listeners} attributes={attributes} />
    </div>
  )
}

function scoreSuggestion(lineLabel: string, accountName: string) {
  const a = accountName.toLowerCase()
  const l = lineLabel.toLowerCase()
  let score = 0
  for (const token of l.split(/[^a-z0-9]+/g).filter(Boolean)) {
    if (token.length < 3) continue
    if (a.includes(token)) score += 2
  }
  if (a.includes(l)) score += 5
  if (l.includes('rent') && a.includes('rent')) score += 5
  if (l.includes('insurance') && a.includes('insurance')) score += 5
  return score
}

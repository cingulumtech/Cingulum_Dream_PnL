import React, { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Filter, MousePointer2, Search, Undo2, Wand2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { computeDream } from '../lib/dream/compute'
import { DreamLine, XeroPLSection } from '../lib/types'
import { setLineMappings } from '../lib/dream/edit'
import { flattenLines } from '../lib/dream/schema'
import { Button, Card, Chip, Input, Label } from './ui'
import { SaveStatusPill } from './SaveStatus'

type AccountRow = { name: string; section: XeroPLSection }

const SECTION_LABEL: Record<XeroPLSection, string> = {
  trading_income: 'Revenue',
  other_income: 'Revenue',
  cost_of_sales: 'COGS',
  operating_expenses: 'OpEx',
  unknown: 'Other',
}

const sectionFilterDefs = [
  { id: 'unmapped', label: 'Unmapped only' },
  { id: 'all', label: 'All accounts' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expense', label: 'Expenses' },
] as const

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
  const [matcher, setMatcher] = useState('')
  const [excludeMatcher, setExcludeMatcher] = useState('')
  const [draggingAcc, setDraggingAcc] = useState<string | null>(null)
  const [hoverLineId, setHoverLineId] = useState<string | null>(null)

  const lines = useMemo(() => flattenLines(template.root), [template])
  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])

  const selectedLine = useMemo(() => lines.find(l => l.id === selectedLineId) ?? null, [lines, selectedLineId])

  const accounts = useMemo<AccountRow[]>(() => {
    if (!pl) return []
    return [...pl.accounts]
      .map(a => ({ name: a.name, section: a.section }))
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

  const includeRegex = useMemo(() => {
    if (!matcher.trim()) return null
    try {
      return new RegExp(matcher, 'i')
    } catch {
      return null
    }
  }, [matcher])

  const excludeRegex = useMemo(() => {
    if (!excludeMatcher.trim()) return null
    try {
      return new RegExp(excludeMatcher, 'i')
    } catch {
      return null
    }
  }, [excludeMatcher])

  const filteredAccounts = useMemo(() => {
    const needle = qAcc.toLowerCase()
    return accounts
      .filter(a => {
        if (accountFilter === 'unmapped') return !mappedSet.has(a.name)
        if (accountFilter === 'revenue') return a.section === 'trading_income' || a.section === 'other_income'
        if (accountFilter === 'expense') return a.section === 'cost_of_sales' || a.section === 'operating_expenses'
        return true
      })
      .filter(a => !needle || a.name.toLowerCase().includes(needle))
  }, [accounts, qAcc, accountFilter, mappedSet])

  const matcherPreview = useMemo(() => {
    if (!includeRegex) return { matches: [] as AccountRow[], excluded: [] as AccountRow[] }
    const matches = accounts.filter(a => includeRegex.test(a.name))
    const excluded = excludeRegex ? matches.filter(a => excludeRegex.test(a.name)) : []
    const finalMatches = matches.filter(a => !excludeRegex || !excludeRegex.test(a.name))
    return { matches: finalMatches, excluded }
  }, [accounts, includeRegex, excludeRegex])

  const matcherSet = useMemo(() => new Set(matcherPreview.matches.map(a => a.name)), [matcherPreview])
  const excludedMatcherSet = useMemo(() => new Set(matcherPreview.excluded.map(a => a.name)), [matcherPreview])

  if (!pl) {
    return (
      <Card className="p-6 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-cyan-400/10 border border-indigo-400/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Mapping</div>
            <div className="text-sm text-slate-200">Import the Profit &amp; Loss export to start mapping Xero accounts.</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => document.getElementById('pl-upload-input')?.click()}>Upload P&amp;L</Button>
            <Button variant="ghost" onClick={() => document.getElementById('gl-upload-input')?.click()}>Upload GL (optional)</Button>
          </div>
        </div>
      </Card>
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

  function applyMatcherToLine() {
    if (!selectedLine || matcherPreview.matches.length === 0) return
    const merged = Array.from(new Set([...selectedLine.mappedAccounts, ...matcherPreview.matches.map(m => m.name)]))
    setMappings(selectedLine, merged)
  }

  function handleDropOnLine(e: React.DragEvent, lineId: string) {
    e.preventDefault()
    const acc = draggingAcc || e.dataTransfer.getData('text/plain')
    if (!acc) return
    mapAccountToLine(lineId, acc)
    setHoverLineId(null)
  }

  function handleUnassignDrop(e: React.DragEvent) {
    if (!selectedLine) return
    e.preventDefault()
    const acc = draggingAcc || e.dataTransfer.getData('text/plain')
    if (!acc) return
    removeAccountFromLine(selectedLine, acc)
  }

  return (
    <Card className="p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Mapping</div>
          <div className="text-sm text-slate-300">
            Assign Xero accounts to your management layout. Unmapped accounts are highlighted by default (so you can mop them up fast).
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Chip>{unmappedAccounts.length} unmapped accounts</Chip>
          <SaveStatusPill status={templateSaveStatus} />
        </div>
      </div>
      {readOnly && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          View-only access enabled. Contact an admin to unlock editing.
        </div>
      )}

      <div className={`mt-5 grid grid-cols-1 gap-4 md:grid-cols-[420px,minmax(0,1fr)] ${readOnly ? 'pointer-events-none opacity-70' : ''}`}>
        {/* Left: Dream lines */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-300" />
            <Input value={qLine} onChange={e => setQLine(e.target.value)} placeholder="Search layout lines…" />
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
            <MousePointer2 className="h-3 w-3" />
            Drag accounts from the right and drop on a line to map.
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto pr-1">
            {filteredLines.map(l => (
              <div
                key={l.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border transition ${
                  selectedLineId === l.id
                    ? 'bg-indigo-500/20 border-indigo-400/40 ring-1 ring-indigo-400/30'
                    : hoverLineId === l.id
                      ? 'bg-indigo-500/15 border-indigo-400/30'
                      : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                } ${draggingAcc ? 'border-dashed border-white/20' : ''}`}
                onClick={() => setSelectedLineIdLocal(l.id)}
                onDragOver={e => {
                  e.preventDefault()
                  setHoverLineId(l.id)
                }}
                onDragLeave={() => setHoverLineId(null)}
                onDrop={e => handleDropOnLine(e, l.id)}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{l.label}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    {l.mappedAccounts.length ? `${l.mappedAccounts.length} mapped` : 'Unmapped'}
                    {selectedLineId === l.id && draggingAcc && <span className="text-indigo-200">Release to map</span>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          {/* Right: Accounts picker */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
            {!selectedLine ? (
              <div className="text-sm text-slate-300">Select a layout line to map accounts.</div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-base font-semibold">{selectedLine.label}</div>
                    <div className="text-xs text-slate-400">Tap accounts to toggle. Drag-and-drop also works.</div>
                  </div>

                  <div>
                    <Label>Mapped accounts</Label>
                    <div
                      className={`mt-2 flex flex-wrap gap-2 min-h-[48px] rounded-xl border px-2 py-2 transition ${
                        draggingAcc ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-black/20'
                      }`}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleUnassignDrop}
                    >
                      {selectedLine.mappedAccounts.length === 0 && <Chip>Drop accounts to map</Chip>}
                      {selectedLine.mappedAccounts.map(a => (
                        <Chip
                          key={a}
                          className="cursor-pointer hover:bg-rose-500/10"
                          title="Click to remove"
                          onClick={() => toggleAccount(selectedLine, a)}
                          draggable
                          onDragStart={e => {
                            setDraggingAcc(a)
                            e.dataTransfer.setData('text/plain', a)
                          }}
                          onDragEnd={() => setDraggingAcc(null)}
                        >
                          <Check className="h-3 w-3" /> {a}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                      <MousePointer2 className="h-3 w-3" />
                      Drag a mapped chip outside this box to unassign quickly.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label>Matcher preview</Label>
                      <Input value={matcher} onChange={e => setMatcher(e.target.value)} placeholder="Regex, e.g. rent|lease" />
                      {!includeRegex && matcher.trim() && (
                        <div className="mt-1 text-xs text-rose-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Invalid matcher regex.
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Exclude</Label>
                      <Input value={excludeMatcher} onChange={e => setExcludeMatcher(e.target.value)} placeholder="Regex to exclude" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <Chip tone={matcherPreview.matches.length ? 'good' : 'neutral'}>
                      {matcherPreview.matches.length} matched
                    </Chip>
                    {matcherPreview.excluded.length > 0 && <Chip tone="bad">{matcherPreview.excluded.length} excluded</Chip>}
                    <Button
                      variant="ghost"
                      onClick={applyMatcherToLine}
                      disabled={!selectedLine || matcherPreview.matches.length === 0 || !includeRegex}
                    >
                      <Filter className="h-4 w-4" /> Map matched
                    </Button>
                    {computed && (
                      <span className="text-slate-400">
                        Line total preview: {(computed.byLineId[selectedLine.id]?.reduce((a, b) => a + b, 0) ?? 0).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
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
                  placeholder="Search Xero accounts…"
                  className="w-64"
                />
              </div>
            </div>

            <div className="mt-3 max-h-[360px] overflow-auto pr-1">
              {filteredAccounts.map(a => {
                const active = selectedLine?.mappedAccounts.includes(a.name)
                const matched = matcherSet.has(a.name)
                const excluded = excludedMatcherSet.has(a.name)
                return (
                  <div
                    key={a.name}
                    draggable
                    onDragStart={e => {
                      setDraggingAcc(a.name)
                      e.dataTransfer.setData('text/plain', a.name)
                    }}
                    onDragEnd={() => setDraggingAcc(null)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border ${
                      active
                        ? 'bg-indigo-500/20 border-indigo-400/40 ring-1 ring-indigo-400/30'
                        : matched
                          ? 'bg-emerald-500/10 border-emerald-400/30'
                          : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                    } ${excluded ? 'opacity-60' : ''}`}
                    onClick={() => selectedLine && toggleAccount(selectedLine, a.name)}
                  >
                    <div className="truncate">
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-slate-400">{SECTION_LABEL[a.section]}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-indigo-200" />}
                  </div>
                )
              })}
              {filteredAccounts.length === 0 && <div className="text-sm text-slate-400 mt-2">No accounts match this filter.</div>}
            </div>
          </div>
        </div>
      </div>
    </Card>
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

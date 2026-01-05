import React, { useMemo, useState } from 'react'
import { Check, ChevronRight, Search, Wand2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { computeDream } from '../lib/dream/compute'
import { DreamGroup, DreamLine } from '../lib/types'
import { setLineMappings } from '../lib/dream/edit'
import { Button, Card, Chip, Input, Label } from './ui'

function flattenLines(node: DreamGroup, out: DreamLine[] = []) {
  for (const child of node.children) {
    if (child.kind === 'line') out.push(child)
    else flattenLines(child, out)
  }
  return out
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

export function MappingEditor() {
  const pl = useAppStore(s => s.pl)
  const template = useAppStore(s => s.template)
  const setTemplate = useAppStore(s => s.setTemplate)

  const [selectedLineId, setSelectedLineIdLocal] = useState<string | null>(null)
  const [qLine, setQLine] = useState('')
  const [qAcc, setQAcc] = useState('')

  const lines = useMemo(() => flattenLines(template.root), [template])
  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])

  const selectedLine = useMemo(() => lines.find(l => l.id === selectedLineId) ?? null, [lines, selectedLineId])
  const accountNames = useMemo(() => (pl ? pl.accounts.map(a => a.name).sort((a, b) => a.localeCompare(b)) : []), [pl])

  const mappedSet = useMemo(() => {
    const s = new Set<string>()
    for (const ln of lines) for (const a of ln.mappedAccounts) s.add(a)
    return s
  }, [lines])

  const unmappedAccounts = useMemo(() => accountNames.filter(a => !mappedSet.has(a)), [accountNames, mappedSet])

  const filteredLines = useMemo(() => {
    const needle = qLine.toLowerCase()
    return lines.filter(l => !needle || l.label.toLowerCase().includes(needle))
  }, [lines, qLine])

  const filteredAccounts = useMemo(() => {
    const needle = qAcc.toLowerCase()
    const list = (needle ? accountNames.filter(a => a.toLowerCase().includes(needle)) : unmappedAccounts)
    return list.slice(0, 200)
  }, [accountNames, unmappedAccounts, qAcc])

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

  function toggleAccount(acc: string) {
    if (!selectedLine) return
    const existing = new Set(selectedLine.mappedAccounts)
    if (existing.has(acc)) existing.delete(acc)
    else existing.add(acc)

    setTemplate(setLineMappings(template, selectedLine.id, Array.from(existing).sort((a, b) => a.localeCompare(b))))
  }

  function autoSuggest() {
    if (!selectedLine) return
    const scored = unmappedAccounts
      .map(a => ({ a, s: scoreSuggestion(selectedLine.label, a) }))
      .filter(x => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 10)
      .map(x => x.a)
    if (!scored.length) return
    const merged = Array.from(new Set([...selectedLine.mappedAccounts, ...scored]))
    setTemplate(setLineMappings(template, selectedLine.id, merged))
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
          <Chip>{unmappedAccounts.length} unmapped accounts</Chip>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[380px,1fr]">
        {/* Left: Dream lines */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-300" />
            <Input value={qLine} onChange={e => setQLine(e.target.value)} placeholder="Search layout lines…" />
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto pr-1">
            {filteredLines.map(l => (
              <div
                key={l.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border ${
                  selectedLineId === l.id ? 'bg-indigo-500/15 border-indigo-400/30' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                }`}
                onClick={() => setSelectedLineIdLocal(l.id)}
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{l.label}</div>
                  <div className="text-xs text-slate-400">
                    {l.mappedAccounts.length ? `${l.mappedAccounts.length} mapped` : 'Unmapped'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Accounts picker */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          {!selectedLine ? (
            <div className="text-sm text-slate-300">Select a layout line to map accounts.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{selectedLine.label}</div>
                  <div className="text-xs text-slate-400">Tap accounts to toggle. Think “photo editing”: fast, reversible, obvious.</div>
                </div>
                <Button variant="ghost" onClick={autoSuggest}>
                  <Wand2 className="h-4 w-4" /> Suggest
                </Button>
              </div>

              <div className="mt-3">
                <Label>Mapped accounts</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedLine.mappedAccounts.length === 0 && <Chip>None yet</Chip>}
                  {selectedLine.mappedAccounts.map(a => (
                    <Chip
                      key={a}
                      className="cursor-pointer hover:bg-rose-500/10"
                      title="Click to remove"
                      onClick={() => toggleAccount(a)}
                    >
                      <Check className="h-3 w-3" /> {a}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-300" />
                <Input value={qAcc} onChange={e => setQAcc(e.target.value)} placeholder="Search Xero accounts… (blank shows unmapped)" />
              </div>

              <div className="mt-3 max-h-[360px] overflow-auto pr-1">
                {filteredAccounts.map(a => {
                  const active = selectedLine.mappedAccounts.includes(a)
                  return (
                    <div
                      key={a}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm cursor-pointer border ${
                        active ? 'bg-indigo-500/15 border-indigo-400/30' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                      }`}
                      onClick={() => toggleAccount(a)}
                    >
                      <div className="truncate">{a}</div>
                      {active && <Check className="h-4 w-4 text-indigo-200" />}
                    </div>
                  )
                })}
                {filteredAccounts.length === 0 && <div className="text-sm text-slate-400">No accounts found.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

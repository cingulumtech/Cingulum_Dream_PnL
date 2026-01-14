import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Download, FolderPlus, Plus, RotateCcw, ShieldCheck, Type, Upload } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { DreamGroup, DreamLine } from '../lib/types'
import { addGroup, addLine, findNode, findParent, moveChild, removeNode, setLineMappings, updateNodeLabel } from '../lib/dream/edit'
import { Button, Card, Chip, Input, Label } from './ui'
import { SaveStatusPill } from './SaveStatus'
import { DREAM_TEMPLATE_SCHEMA, flattenLines, generateNodeId, validateTemplate } from '../lib/dream/schema'
import { computeDream, computeDreamTotals } from '../lib/dream/compute'

export function TemplateEditor() {
  const template = useAppStore(s => s.template)
  const setTemplate = useAppStore(s => s.setTemplate)
  const resetTemplate = useAppStore(s => s.resetTemplate)
  const pl = useAppStore(s => s.pl)
  const undoTemplate = useAppStore(s => s.undoTemplate)
  const canUndo = useAppStore(s => s.canUndo())
  const templateSaveStatus = useAppStore(s => s.templateSaveStatus)

  const [selectedId, setSelectedId] = useState(template.root.id)
  const [rename, setRename] = useState('')
  const [templateName, setTemplateName] = useState(template.name)
  const [migrateTargetId, setMigrateTargetId] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  const lines = useMemo(() => flattenLines(template.root), [template])
  const validationIssues = useMemo(() => validateTemplate(template), [template])

  const selectedNode = useMemo(() => findNode(template.root, selectedId) ?? template.root, [template, selectedId])
  const selectedParent = useMemo(() => findParent(template.root, selectedId), [template, selectedId])

  const computed = useMemo(() => (pl ? computeDream(pl, template) : null), [pl, template])
  const totals = useMemo(() => (pl && computed ? computeDreamTotals(pl, template, computed) : null), [pl, computed, template])

  useEffect(() => {
    setTemplateName(template.name)
  }, [template.name])

  useEffect(() => {
    const fallback = lines.find(l => l.id !== selectedId)?.id ?? null
    setMigrateTargetId(fallback)
  }, [selectedId, lines])

  const hasMappedDescendants = useMemo(() => {
    if (selectedNode.kind === 'line') return selectedNode.mappedAccounts.length > 0
    const descendants: DreamLine[] = []
    flattenLines(selectedNode as DreamGroup, descendants)
    return descendants.some(l => l.mappedAccounts.length > 0)
  }, [selectedNode])

  function commitRename() {
    const label = rename.trim()
    if (!label) return
    setTemplate(updateNodeLabel(template, selectedNode.id, label))
    setRename('')
  }

  function handleAddLine() {
    const parentId = selectedNode.kind === 'group' ? selectedNode.id : selectedParent?.parent.id ?? template.root.id
    const ln: DreamLine = { id: generateNodeId('line'), kind: 'line', label: 'New line', mappedAccounts: [] }
    setTemplate(addLine(template, parentId, ln))
  }

  function handleAddGroup() {
    const parentId = selectedNode.kind === 'group' ? selectedNode.id : selectedParent?.parent.id ?? template.root.id
    const g: DreamGroup = { id: generateNodeId('group'), kind: 'group', label: 'New group', children: [] }
    setTemplate(addGroup(template, parentId, g))
  }

  function move(dir: -1 | 1) {
    moveNode(selectedId, dir)
  }

  function moveNode(nodeId: string, dir: -1 | 1) {
    const info = findParent(template.root, nodeId)
    if (!info) return
    const to = info.index + dir
    if (to < 0 || to >= info.parent.children.length) return
    setTemplate(moveChild(template, info.parent.id, info.index, to))
    setSelectedId(nodeId)
  }

  function deleteSelected() {
    if (!selectedParent) return
    if (selectedNode.kind === 'line' && selectedNode.mappedAccounts.length && migrateTargetId) {
      const target = lines.find(l => l.id === migrateTargetId)
      if (target) {
        const merged = Array.from(new Set([...target.mappedAccounts, ...selectedNode.mappedAccounts]))
        const withMappings = setLineMappings(template, target.id, merged)
        setTemplate(removeNode(withMappings, selectedNode.id))
        setSelectedId(target.id)
        return
      }
    }

    setTemplate(removeNode(template, selectedNode.id))
    setSelectedId(template.root.id)
  }

  async function importTemplateFile(file: File | null) {
    if (!file) return
    const txt = await file.text()
    try {
      const parsed = JSON.parse(txt)
      const issues = validateTemplate(parsed)
      const errors = issues.filter(i => i.level === 'error')
      if (errors.length) {
        setImportMessage(errors.map(e => e.message).join(' '))
        return
      }
      setTemplate(parsed, { preserveVersion: true })
      setSelectedId(parsed.root?.id ?? template.root.id)
      setImportMessage(issues.length ? issues.map(i => i.message).join(' ') : 'Imported successfully.')
    } catch (e) {
      setImportMessage('Invalid JSON template.')
    }
  }

  function renderTree(node: DreamGroup | DreamLine, depth = 0) {
    const isSelected = node.id === selectedId
    const mappedCount = node.kind === 'line' ? node.mappedAccounts.length : null
    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center justify-between rounded-xl px-3 py-2 border cursor-pointer ${
            isSelected ? 'bg-indigo-500/15 border-indigo-400/30' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
          }`}
          style={{ marginLeft: depth * 12 }}
          onClick={() => {
            setSelectedId(node.id)
            setRename('')
          }}
          title={mappedCount ? `${mappedCount} mapped accounts` : undefined}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-2 w-2 rounded-full ${node.kind === 'group' ? 'bg-indigo-300' : 'bg-white/70'}`} />
            <div className="font-semibold truncate">{node.label}</div>
            <Chip className="px-2">{node.kind === 'group' ? 'Group' : 'Line'}</Chip>
            {mappedCount != null && mappedCount > 0 && <Chip tone="good" className="px-2">{mappedCount} mapped</Chip>}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp
              className={`h-4 w-4 ${isSelected ? 'text-slate-100' : 'text-slate-500'}`}
              onClick={e => {
                e.stopPropagation()
                moveNode(node.id, -1)
              }}
            />
            <ArrowDown
              className={`h-4 w-4 ${isSelected ? 'text-slate-100' : 'text-slate-500'}`}
              onClick={e => {
                e.stopPropagation()
                moveNode(node.id, 1)
              }}
            />
          </div>
        </div>
        {node.kind === 'group' && node.children.map(child => renderTree(child, depth + 1))}
      </div>
    )
  }

  const blockingDelete =
    selectedNode.kind === 'line' &&
    selectedNode.mappedAccounts.length > 0 &&
    (!migrateTargetId || migrateTargetId === selectedNode.id)

  const metadataChipTone: 'good' | 'bad' =
    template.schemaVersion === DREAM_TEMPLATE_SCHEMA ? 'good' : 'bad'

  return (
    <Card className="p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Layout</div>
          <div className="text-sm text-slate-300">
            Edit categories and line items like an iPhone editor: select, rename, move, add, delete. Mapping stays separate.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={metadataChipTone}>
            Schema {template.schemaVersion || 'unknown'} • v{template.version ?? 1}
          </Chip>
          <SaveStatusPill status={templateSaveStatus} />
          <Button variant="ghost" onClick={() => undoTemplate()} disabled={!canUndo}>
            <RotateCcw className="h-4 w-4" /> Undo
          </Button>
        </div>
      </div>

      {validationIssues.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <div className="font-semibold">Validation</div>
            <ul className="list-disc list-inside text-amber-100/90">
              {validationIssues.map((i, idx) => (
                <li key={idx}>
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-white/10 mr-2">{i.level}</span>
                  {i.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[420px,1fr]">
        {/* Left: Tree */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <Label>Tree</Label>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleAddLine}>
                <Plus className="h-4 w-4" /> Add line
              </Button>
              <Button variant="ghost" onClick={handleAddGroup}>
                <FolderPlus className="h-4 w-4" /> Add group
              </Button>
            </div>
          </div>
          <div className="mt-3 max-h-[520px] overflow-auto pr-1">{renderTree(template.root)}</div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
            {!selectedNode ? (
              <div className="text-sm text-slate-300">Select a group or item.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{selectedNode.label}</div>
                    <div className="text-xs text-slate-400">{selectedNode.kind === 'group' ? 'Group' : 'Line item'}</div>
                    {selectedNode.kind === 'line' && selectedNode.mappedAccounts.length > 0 && (
                      <div className="mt-1 text-xs text-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> {selectedNode.mappedAccounts.length} mapped accounts protected
                      </div>
                    )}
                    {selectedNode.kind === 'group' && hasMappedDescendants && (
                      <div className="mt-1 text-xs text-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Contains mapped lines
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => move(-1)} disabled={!selectedParent}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" onClick={() => move(1)} disabled={!selectedParent}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="danger" onClick={deleteSelected} disabled={!selectedParent || blockingDelete}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Rename</Label>
                  <div className="mt-2 flex gap-2">
                    <Input value={rename} onChange={e => setRename(e.target.value)} placeholder={selectedNode.label} />
                    <Button variant="ghost" onClick={commitRename}>
                      <Type className="h-4 w-4" /> Apply
                    </Button>
                  </div>
                </div>

                {selectedNode.kind === 'line' && selectedNode.mappedAccounts.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
                    <div className="text-xs text-amber-200 font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" /> Protect mapped accounts
                    </div>
                    <div className="mt-2 text-xs text-amber-100">
                      Choose a destination line to migrate mapped accounts before deleting.
                    </div>
                    <div className="mt-2">
                      <select
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100"
                        value={migrateTargetId ?? ''}
                        onChange={e => setMigrateTargetId(e.target.value || null)}
                      >
                        <option value="">Select destination</option>
                        {lines
                          .filter(l => l.id !== selectedNode.id)
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              {l.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    {blockingDelete && <div className="mt-2 text-xs text-rose-200">Select a destination to proceed.</div>}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Template name</Label>
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} />
                <Button
                  className="mt-2"
                  variant="ghost"
                  onClick={() => templateName.trim() && setTemplate({ ...template, name: templateName.trim() })}
                >
                  Save name
                </Button>
              </div>
              <div>
                <Label>Metadata</Label>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                  <Chip>Schema: {template.schemaVersion}</Chip>
                  <Chip>Version: v{template.version}</Chip>
                  <Chip>ID: {template.id}</Chip>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>Export / import template JSON</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `dream-template-${template.version}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  <Download className="h-4 w-4" /> Export
                </Button>

                <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer">
                  <Upload className="h-4 w-4" /> Import
                  <input type="file" accept="application/json" className="hidden" onChange={e => importTemplateFile(e.target.files?.[0] ?? null)} />
                </label>
                <Button variant="ghost" onClick={() => resetTemplate()}>
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
              {importMessage && <div className="mt-2 text-xs text-slate-300">{importMessage}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Management P&amp;L preview</div>
            <div className="text-xs text-slate-400">Live totals from the current template. Upload P&amp;L to populate.</div>
          </div>
          <Chip>{pl ? 'Live' : 'Awaiting upload'}</Chip>
        </div>

        {totals ? (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <PreviewStat label="12-mo Revenue" value={totals.revenue.reduce((a, b) => a + b, 0)} />
            <PreviewStat label="12-mo COGS" value={totals.cogs.reduce((a, b) => a + b, 0)} />
            <PreviewStat label="12-mo OpEx" value={totals.opex.reduce((a, b) => a + b, 0)} />
            <PreviewStat label="12-mo Net" value={totals.net.reduce((a, b) => a + b, 0)} />
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-400">Upload a Profit &amp; Loss export to preview totals.</div>
        )}
      </div>
    </Card>
  )
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}
      </div>
    </div>
  )
}

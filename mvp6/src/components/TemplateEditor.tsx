import React, { useMemo, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, FolderPlus, Type, RotateCcw, Download, Upload } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { DreamGroup, DreamLine } from '../lib/types'
import { addGroup, addLine, moveChild, removeNode, updateNodeLabel } from '../lib/dream/edit'
import { Button, Card, Chip, Input, Label } from './ui'

function isGroup(n: DreamGroup | DreamLine): n is DreamGroup {
  return n.kind === 'group'
}

function findGroup(root: DreamGroup, id: string): DreamGroup | null {
  if (root.id === id) return root
  for (const child of root.children) {
    if (child.kind === 'group') {
      const hit = findGroup(child, id)
      if (hit) return hit
    }
  }
  return null
}

export function TemplateEditor() {
  const template = useAppStore(s => s.template)
  const setTemplate = useAppStore(s => s.setTemplate)
  const resetTemplate = useAppStore(s => s.resetTemplate)

  const [selectedGroupId, setSelectedGroupId] = useState('rev')
  const [selectedChildIdx, setSelectedChildIdx] = useState<number | null>(null)
  const [rename, setRename] = useState('')

  const group = useMemo(() => findGroup(template.root, selectedGroupId), [template, selectedGroupId])

  const selectedNode = useMemo(() => {
    if (!group) return null
    if (selectedChildIdx == null) return group
    return group.children[selectedChildIdx] ?? null
  }, [group, selectedChildIdx])

  const jsonExport = useMemo(() => JSON.stringify(template, null, 2), [template])

  function commitRename() {
    if (!selectedNode) return
    const label = rename.trim()
    if (!label) return
    setTemplate(updateNodeLabel(template, selectedNode.id, label))
  }

  function addNewLine() {
    if (!group) return
    const id = `line_${Date.now()}`
    const ln: DreamLine = { id, kind: 'line', label: 'New line', mappedAccounts: [] }
    setTemplate(addLine(template, group.id, ln))
  }

  function addNewGroup() {
    if (!group) return
    const id = `group_${Date.now()}`
    const g: DreamGroup = { id, kind: 'group', label: 'New group', children: [] }
    setTemplate(addGroup(template, group.id, g))
  }

  function move(dir: -1 | 1) {
    if (!group || selectedChildIdx == null) return
    const to = selectedChildIdx + dir
    if (to < 0 || to >= group.children.length) return
    setTemplate(moveChild(template, group.id, selectedChildIdx, to))
    setSelectedChildIdx(to)
  }

  function del() {
    if (!selectedNode) return
    if (selectedNode.id === template.root.id) return
    setTemplate(removeNode(template, selectedNode.id))
    setSelectedChildIdx(null)
  }

  async function importTemplateFile(file: File | null) {
    if (!file) return
    const txt = await file.text()
    try {
      const parsed = JSON.parse(txt)
      setTemplate(parsed)
    } catch (e) {
      alert('Invalid JSON template.')
    }
  }

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
          <Button variant="ghost" onClick={() => resetTemplate()}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[420px,1fr]">
        {/* Left: Structure */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <Label>Top-level groups</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.root.children
              .filter(isGroup)
              .map(g => (
                <Chip
                  key={g.id}
                  className={`cursor-pointer ${selectedGroupId === g.id ? 'bg-indigo-500/15 border-indigo-400/30' : ''}`}
                  onClick={() => {
                    setSelectedGroupId(g.id)
                    setSelectedChildIdx(null)
                    setRename('')
                  }}
                >
                  {g.label}
                </Chip>
              ))}
          </div>

          <div className="mt-4">
            <Label>Items in selected group</Label>
            <div className="mt-2 max-h-[520px] overflow-auto pr-1">
              {!group ? (
                <div className="text-sm text-slate-400">Group not found.</div>
              ) : (
                group.children.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`rounded-xl px-3 py-2 border cursor-pointer ${
                      selectedChildIdx === idx ? 'bg-indigo-500/15 border-indigo-400/30' : 'bg-transparent border-white/0 hover:bg-white/5 hover:border-white/10'
                    }`}
                    onClick={() => {
                      setSelectedChildIdx(idx)
                      setRename('')
                    }}
                  >
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="text-xs text-slate-400">{c.kind === 'group' ? 'Group' : 'Line'}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={addNewLine}>
              <Plus className="h-4 w-4" /> Add line
            </Button>
            <Button variant="ghost" onClick={addNewGroup}>
              <FolderPlus className="h-4 w-4" /> Add group
            </Button>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          {!selectedNode ? (
            <div className="text-sm text-slate-300">Select a group or item.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{selectedNode.label}</div>
                  <div className="text-xs text-slate-400">{selectedNode.kind === 'group' ? 'Group' : 'Line item'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => move(-1)} disabled={selectedChildIdx == null}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => move(1)} disabled={selectedChildIdx == null}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="danger" onClick={del} disabled={selectedNode.id === template.root.id}>
                    <Trash2 className="h-4 w-4" />
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

              <div className="mt-6">
                <Label>Export / import template JSON</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const blob = new Blob([jsonExport], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'dream-template.json'
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
                </div>
                <textarea
                  readOnly
                  value={jsonExport}
                  className="mt-3 w-full h-64 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-slate-200 font-mono"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

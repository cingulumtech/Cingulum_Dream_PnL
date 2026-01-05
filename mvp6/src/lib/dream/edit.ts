import { DreamGroup, DreamLine, DreamTemplate } from '../types'
import { cloneTemplate } from './schema'

export function findPath(root: DreamGroup, id: string, path: string[] = []): string[] | null {
  if (root.id === id) return path.concat(root.id)
  for (const child of root.children) {
    if (child.id === id) return path.concat(root.id, child.id)
    if (child.kind === 'group') {
      const hit = findPath(child, id, path.concat(root.id))
      if (hit) return hit
    }
  }
  return null
}

export function findNode(root: DreamGroup, id: string): DreamGroup | DreamLine | null {
  if (root.id === id) return root
  for (const child of root.children) {
    if (child.id === id) return child
    if (child.kind === 'group') {
      const hit = findNode(child, id)
      if (hit) return hit
    }
  }
  return null
}

export function findParent(root: DreamGroup, id: string): { parent: DreamGroup; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]
    if (child.id === id) return { parent: root, index: i }
    if (child.kind === 'group') {
      const hit = findParent(child, id)
      if (hit) return hit
    }
  }
  return null
}

export function updateNodeLabel(t: DreamTemplate, nodeId: string, label: string): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup) => {
    if (g.id === nodeId) g.label = label
    for (const c of g.children) {
      if (c.id === nodeId) c.label = label
      if (c.kind === 'group') walk(c)
    }
  }
  walk(next.root)
  return next
}

export function setLineMappings(t: DreamTemplate, lineId: string, mappedAccounts: string[]): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup) => {
    for (const c of g.children) {
      if (c.kind === 'line' && c.id === lineId) c.mappedAccounts = mappedAccounts
      if (c.kind === 'group') walk(c)
    }
  }
  walk(next.root)
  return next
}

export function addLine(t: DreamTemplate, parentGroupId: string, line: DreamLine): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup) => {
    if (g.id === parentGroupId) {
      g.children.push(line)
      return true
    }
    for (const c of g.children) {
      if (c.kind === 'group') {
        const ok = walk(c)
        if (ok) return true
      }
    }
    return false
  }
  walk(next.root)
  return next
}

export function addGroup(t: DreamTemplate, parentGroupId: string, group: DreamGroup): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup) => {
    if (g.id === parentGroupId) {
      g.children.push(group)
      return true
    }
    for (const c of g.children) {
      if (c.kind === 'group') {
        const ok = walk(c)
        if (ok) return true
      }
    }
    return false
  }
  walk(next.root)
  return next
}

export function removeNode(t: DreamTemplate, nodeId: string): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup) => {
    g.children = g.children.filter(c => c.id !== nodeId)
    for (const c of g.children) if (c.kind === 'group') walk(c)
  }
  walk(next.root)
  // never remove root
  return next
}

export function moveChild(t: DreamTemplate, parentId: string, fromIdx: number, toIdx: number): DreamTemplate {
  const next = cloneTemplate(t)
  const walk = (g: DreamGroup): boolean => {
    if (g.id === parentId) {
      const arr = g.children
      if (fromIdx < 0 || fromIdx >= arr.length || toIdx < 0 || toIdx >= arr.length) return true
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return true
    }
    for (const c of g.children) {
      if (c.kind === 'group') {
        const ok = walk(c)
        if (ok) return true
      }
    }
    return false
  }
  walk(next.root)
  return next
}

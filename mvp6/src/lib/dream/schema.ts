import { DreamGroup, DreamLine, DreamTemplate, TemplateValidationIssue } from '../types'

export const DREAM_TEMPLATE_SCHEMA = 'dream-template/v1'

export function cloneTemplate(t: DreamTemplate): DreamTemplate {
  return JSON.parse(JSON.stringify(t))
}

export function ensureTemplateMetadata(t: DreamTemplate, opts?: { preserveVersion?: boolean }): DreamTemplate {
  const next = cloneTemplate(t)
  next.schemaVersion = next.schemaVersion || DREAM_TEMPLATE_SCHEMA
  const currentVersion = Number.isFinite(next.version) ? next.version : 1
  next.version = opts?.preserveVersion ? currentVersion : currentVersion + 1
  return next
}

export function collectNodeIds(root: DreamGroup): string[] {
  const ids: string[] = []
  const walk = (node: DreamGroup | DreamLine) => {
    ids.push(node.id)
    if (node.kind === 'group') {
      node.children.forEach(walk)
    }
  }
  walk(root)
  return ids
}

export function validateTemplate(template: DreamTemplate): TemplateValidationIssue[] {
  const issues: TemplateValidationIssue[] = []

  if (!template.schemaVersion) {
    issues.push({ level: 'warning', message: 'Missing schemaVersion; assuming latest.' })
  } else if (template.schemaVersion !== DREAM_TEMPLATE_SCHEMA) {
    issues.push({ level: 'warning', message: `Schema version mismatch (${template.schemaVersion}); expected ${DREAM_TEMPLATE_SCHEMA}.` })
  }

  if (!Number.isFinite(template.version)) {
    issues.push({ level: 'warning', message: 'Template version is missing; will default to 1.' })
  }

  if (!template.root || template.root.kind !== 'group') {
    issues.push({ level: 'error', message: 'Template root is missing or invalid.' })
    return issues
  }

  const seen = new Set<string>()
  const walk = (node: DreamGroup | DreamLine) => {
    if (!node.id) {
      issues.push({ level: 'error', message: `Node "${node.label}" is missing an id.` })
    } else if (seen.has(node.id)) {
      issues.push({ level: 'error', message: `Duplicate node id "${node.id}".` })
    } else {
      seen.add(node.id)
    }

    if (node.kind === 'group') node.children.forEach(walk)
  }
  walk(template.root)

  return issues
}

export function flattenLines(node: DreamGroup, out: DreamLine[] = []): DreamLine[] {
  for (const child of node.children) {
    if (child.kind === 'line') out.push(child)
    else flattenLines(child, out)
  }
  return out
}

export function generateNodeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

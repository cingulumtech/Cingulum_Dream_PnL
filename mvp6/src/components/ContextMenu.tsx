import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export type ContextMenuItem = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
}

type ContextMenuState = {
  open: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  title?: string
}

type ContextMenuContextValue = {
  openMenu: (payload: { event: React.MouseEvent; items: ContextMenuItem[]; title?: string }) => void
  closeMenu: () => void
  pushToast: (message: string) => void
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null)

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ContextMenuState>({ open: false, x: 0, y: 0, items: [] })
  const [toast, setToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const closeMenu = useCallback(() => {
    setState(prev => ({ ...prev, open: false }))
  }, [])

  const openMenu = useCallback(
    ({ event, items, title }: { event: React.MouseEvent; items: ContextMenuItem[]; title?: string }) => {
      event.preventDefault()
      const { clientX, clientY } = event
      setState({ open: true, x: clientX, y: clientY, items, title })
    },
    []
  )

  const pushToast = useCallback((message: string) => {
    setToast(message)
  }, [])

  useEffect(() => {
    if (!state.open) return
    const first = menuRef.current?.querySelector('button') as HTMLButtonElement | null
    if (first) first.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [state.open, closeMenu])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const clamped = useMemo(() => {
    const padding = 12
    const width = 220
    const height = state.items.length * 38 + (state.title ? 28 : 0) + 12
    const x = Math.min(state.x, window.innerWidth - width - padding)
    const y = Math.min(state.y, window.innerHeight - height - padding)
    return { x, y }
  }, [state.x, state.y, state.items.length, state.title])

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu, pushToast }}>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            role="menu"
            style={{ left: clamped.x, top: clamped.y }}
            className="fixed z-[60] w-[220px] rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl backdrop-blur"
          >
            {state.title && <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-slate-400">{state.title}</div>}
            <div className="space-y-1">
              {state.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect()
                    closeMenu()
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed bottom-6 right-6 z-[70] rounded-xl border border-white/10 bg-slate-900/90 px-4 py-2 text-sm text-slate-100 shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </ContextMenuContext.Provider>
  )
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider')
  return ctx
}

export function createCopyMenuItems(payload: {
  label: string
  value: string
  formatted?: string
  onCopied?: () => void
}): ContextMenuItem[] {
  return [
    {
      id: 'copy-raw',
      label: 'Copy value',
      onSelect: async () => {
        await navigator.clipboard.writeText(payload.value)
        payload.onCopied?.()
      },
    },
    {
      id: 'copy-formatted',
      label: 'Copy formatted',
      onSelect: async () => {
        await navigator.clipboard.writeText(payload.formatted ?? payload.value)
        payload.onCopied?.()
      },
    },
    {
      id: 'copy-labeled',
      label: 'Copy with label',
      onSelect: async () => {
        await navigator.clipboard.writeText(`${payload.label}: ${payload.formatted ?? payload.value}`)
        payload.onCopied?.()
      },
    },
  ]
}

export function useCopyMenuItems(payload: { label: string; value: string; formatted?: string }) {
  const { pushToast } = useContextMenu()
  return useMemo<ContextMenuItem[]>(
    () => createCopyMenuItems({ ...payload, onCopied: () => pushToast('Copied') }),
    [payload.formatted, payload.label, payload.value, pushToast]
  )
}

export function buildRowCopyItems(payload: { label: string; row: string[]; onDrill?: () => void; onCopied?: () => void }) {
  const items: ContextMenuItem[] = [
    {
      id: 'copy-row',
      label: 'Copy row (CSV)',
      onSelect: async () => {
        await navigator.clipboard.writeText(payload.row.join(','))
        payload.onCopied?.()
      },
    },
    {
      id: 'copy-label',
      label: 'Copy label',
      onSelect: async () => {
        await navigator.clipboard.writeText(payload.label)
        payload.onCopied?.()
      },
    },
  ]
  if (payload.onDrill) {
    items.push({ id: 'drill', label: 'Drill down', onSelect: payload.onDrill })
  }
  return items
}

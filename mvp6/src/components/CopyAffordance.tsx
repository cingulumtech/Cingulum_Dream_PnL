import React from 'react'
import { Copy } from 'lucide-react'
import { IconButton } from './ui'
import { useContextMenu, useCopyMenuItems } from './ContextMenu'

export function CopyAffordance({ label, value, formatted }: { label: string; value: string; formatted?: string }) {
  const { openMenu, pushToast } = useContextMenu()
  const items = useCopyMenuItems({ label, value, formatted })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted ?? value)
    pushToast('Copied')
  }

  return (
    <IconButton
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        handleCopy()
      }}
      className="h-7 w-7 border-white/10 bg-white/10 text-slate-200 opacity-0 transition group-hover:opacity-100"
      title="Copy value"
      aria-label="Copy value"
      onContextMenu={(event) => openMenu({ event, items, title: label })}
    >
      <Copy className="h-3.5 w-3.5" />
    </IconButton>
  )
}

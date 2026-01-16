import { useRef, useState } from 'react'
import type React from 'react'

type DragHandlers<T extends HTMLElement> = {
  onPointerDown: (event: React.PointerEvent<T>) => void
  onPointerMove: (event: React.PointerEvent<T>) => void
  onPointerUp: (event: React.PointerEvent<T>) => void
  onPointerLeave: (event: React.PointerEvent<T>) => void
  onPointerCancel: (event: React.PointerEvent<T>) => void
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label'

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const start = useRef({ x: 0, scrollLeft: 0 })
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (event: React.PointerEvent<T>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
    const el = ref.current
    if (!el) return
    start.current = { x: event.clientX, scrollLeft: el.scrollLeft }
    setDragging(true)
    el.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<T>) => {
    if (!dragging) return
    const el = ref.current
    if (!el) return
    const delta = event.clientX - start.current.x
    el.scrollLeft = start.current.scrollLeft - delta
  }

  const stop = (event: React.PointerEvent<T>) => {
    const el = ref.current
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  const handlers: DragHandlers<T> = {
    onPointerDown,
    onPointerMove,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  }

  return { ref, dragging, handlers }
}

import React from 'react'
import clsx from 'clsx'

type AppMarkProps = {
  layout?: 'row' | 'stacked'
  size?: 'sm' | 'md'
  caption?: string
}

const LOGO_URL =
  'https://lh3.googleusercontent.com/pw/AP1GczMJ5bIz-U5H0D5BIeE1fqBzofwbDb4mmyJcwwlRHt-JW6EF9k9X8UzzFqSyHr1vTQ5p1MF2KoNf0y1fZWa770vF5vGAnR6sl78alDyz1sb-vYRuOJaCZp6z_QG0e1XI9oqiavdRu0BuqClYjr7yP34l=w180-h180-s-no-gm'

export function AppMark({ layout = 'row', size = 'md', caption }: AppMarkProps) {
  const logoSize = size === 'sm' ? 'h-8' : 'h-10'
  const titleSize = size === 'sm' ? 'text-base' : 'text-lg'

  return (
    <div className={clsx(layout === 'stacked' ? 'flex flex-col gap-2' : 'flex items-center gap-3')}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-[var(--radius-lg)] bg-surfaceStrong/70 border border-border/70 p-2 shadow-glass">
          <img src={LOGO_URL} alt="Cingulum Health" className={`${logoSize} w-auto`} />
        </div>
        <div className="leading-tight">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cingulum Health</div>
          <div className={clsx(titleSize, 'font-semibold text-slate-100')}>Accounting Atlas</div>
        </div>
      </div>
      {caption ? <div className="text-xs text-slate-400 max-w-lg">{caption}</div> : null}
    </div>
  )
}

export default AppMark

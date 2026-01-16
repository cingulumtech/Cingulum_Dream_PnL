import React, { useState } from 'react'
import clsx from 'clsx'

type AppMarkProps = {
  layout?: 'row' | 'stacked'
  size?: 'sm' | 'md'
  caption?: string
}

const LOGO_URL =
  'https://lh3.googleusercontent.com/pw/AP1GczMJ5bIz-U5H0D5BIeE1fqBzofwbDb4mmyJcwwlRHt-JW6EF9k9X8UzzFqSyHr1vTQ5p1MF2KoNf0y1fZWa770vF5vGAnR6sl78alDyz1sb-vYRuOJaCZp6z_QG0e1XI9oqiavdRu0BuqClYjr7yP34l=w180-h180-s-no-gm'
const FALLBACK_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#5b6570"/><path d="M36 60c0-13.3 10.7-24 24-24h24v12H60c-6.6 0-12 5.4-12 12s5.4 12 12 12h24v12H60c-13.3 0-24-10.7-24-24z" fill="#ffffff" opacity="0.85"/></svg>`
  )

export function AppMark({ layout = 'row', size = 'md', caption }: AppMarkProps) {
  const logoSize = size === 'sm' ? 'h-8' : 'h-10'
  const titleSize = size === 'sm' ? 'text-base' : 'text-lg'
  const [logoSrc, setLogoSrc] = useState(LOGO_URL)

  return (
    <div className={clsx(layout === 'stacked' ? 'flex flex-col gap-2' : 'flex items-center gap-3')}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-[var(--radius-lg)] bg-surfaceStrong/70 border border-border/70 p-2 shadow-glass">
          <img
            src={logoSrc}
            alt="Cingulum Health"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={() => setLogoSrc(FALLBACK_LOGO)}
            className={`${logoSize} w-auto`}
          />
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

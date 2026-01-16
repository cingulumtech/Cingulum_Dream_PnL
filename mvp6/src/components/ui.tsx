import React from 'react'
import clsx from 'clsx'

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('ui-card', props.className)} />
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('ui-card-header', props.className)} />
}

export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('ui-card-footer', props.className)} />
}

export function TableToolbar(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('ui-table-toolbar', props.className)} />
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md'
  }
) {
  const { variant = 'primary', size = 'md', className, ...rest } = props
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]'
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: '',
  }
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-accent to-accentSoft text-canvas shadow-glass border-accentSoft/60 hover:brightness-105',
    secondary: 'bg-white/10 text-slate-100 border-white/10 hover:bg-white/15',
    ghost: 'bg-transparent text-slate-100 border-white/10 hover:bg-white/5',
    destructive: 'bg-rose-500/80 hover:bg-rose-500 text-white border-rose-400/40 shadow-glass',
  }
  return <button {...rest} className={clsx(base, sizes[size], variants[variant], className)} />
}

export function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...rest } = props
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
    />
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-accent/40',
        props.className
      )}
    />
  )
}

export function Label(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('text-xs text-slate-300', props.className)} />
}

export function Chip(props: React.HTMLAttributes<HTMLDivElement> & { tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const { tone = 'neutral', className, ...rest } = props
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-slate-200 border-white/10',
    good: 'bg-emerald-500/15 text-emerald-50 border-emerald-400/30',
    bad: 'bg-rose-500/15 text-rose-50 border-rose-400/30',
    warn: 'bg-amber-500/20 text-amber-100 border-amber-400/30',
  }
  return (
    <div
      {...rest}
      className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs', tones[tone], className)}
    />
  )
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  const { checked, onChange, label, disabled } = props
  return (
    <div className={clsx('inline-flex items-center gap-2', disabled && 'opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-emerald-500/30 bg-emerald-500/25' : 'border-white/10 bg-white/5 hover:bg-white/10'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 rounded-full bg-white/80 transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      {label ? <span className="text-xs font-semibold text-slate-100">{label}</span> : null}
    </div>
  )
}

export function Mono(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={clsx('font-mono text-xs text-slate-300', props.className)} />
}

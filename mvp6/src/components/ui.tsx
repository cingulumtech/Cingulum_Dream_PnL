import React from 'react'
import clsx from 'clsx'

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('glass shadow-glass rounded-2xl', props.className)} />
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }
) {
  const { variant = 'primary', className, ...rest } = props
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98]'
  const variants: Record<string, string> = {
    primary:
      'bg-indigo-500/90 hover:bg-indigo-500 text-white shadow-glass border border-indigo-400/40',
    ghost: 'bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10',
    danger: 'bg-rose-500/80 hover:bg-rose-500 text-white border border-rose-400/40',
  }
  return <button {...rest} className={clsx(base, variants[variant], className)} />
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50',
        props.className
      )}
    />
  )
}

export function Label(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('text-xs text-slate-300', props.className)} />
}

export function Chip(props: React.HTMLAttributes<HTMLDivElement> & { tone?: 'neutral' | 'good' | 'bad' }) {
  const { tone = 'neutral', className, ...rest } = props
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-slate-200 border-white/10',
    good: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
    bad: 'bg-rose-500/10 text-rose-200 border-rose-500/20',
  }
  return (
    <div
      {...rest}
      className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs', tones[tone], className)}
    />
  )
}

export function Mono(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={clsx('font-mono text-xs text-slate-300', props.className)} />
}

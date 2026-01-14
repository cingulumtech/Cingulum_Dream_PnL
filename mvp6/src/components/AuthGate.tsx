import React, { useState } from 'react'
import { Card, Input, Label } from './ui'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

export function AuthGate({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const setUser = useAuthStore(s => s.setUser)
  const setStatus = useAuthStore(s => s.setStatus)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password.trim()) {
      setError('Please enter an email and password.')
      return
    }
    setBusy(true)
    try {
      const payload = { email: email.trim(), password: password.trim(), remember }
      const res = mode === 'signin' ? await api.login(payload) : await api.register(payload)
      setUser(res.user)
      setStatus('authenticated')
      await onAuthenticated()
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed')
      setStatus('unauthenticated')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-100">Welcome back</div>
          <div className="text-sm text-slate-300">Sign in to access your Accounting Atlas workspace.</div>
        </div>
      </div>

      <div className="mt-4 flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-full px-3 py-2 font-semibold ${mode === 'signin' ? 'bg-indigo-500/20 text-white' : 'text-slate-300'}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-full px-3 py-2 font-semibold ${mode === 'signup' ? 'bg-indigo-500/20 text-white' : 'text-slate-300'}`}
        >
          Create account
        </button>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div>
          <Label>Email</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-white/10 bg-white/5"
          />
          Remember me
        </label>
        {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500/30 disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </Card>
  )
}

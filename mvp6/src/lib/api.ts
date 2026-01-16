import { DoctorRule, TxnOverride, UserPreference } from './types'

export type ApiUser = {
  id: string
  email: string
  role: string
}

export type SnapshotSummary = {
  kpis: any[]
  periodLabel: string
  comparisonLabel: string
  movementBadge: string
  dataSourceUsed: string
}

export type SnapshotListItem = {
  id: string
  name: string
  owner_user_id: string
  owner_email: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  summary?: SnapshotSummary
  created_at: string
  updated_at: string
}

export type SnapshotPayload = {
  schema_version: string
  data: Record<string, any>
}

export type XeroTenant = {
  tenantId: string
  tenantName: string
}

export type XeroStatus = {
  connected: boolean
  tenantId?: string | null
  expiresAt?: string | null
}

const DEFAULT_API_BASE = '/api'
const RAW_API_BASE = import.meta.env.VITE_API_URL

function normalizeApiBase(rawBase?: string): string {
  if (!rawBase) return DEFAULT_API_BASE
  const trimmed = rawBase.replace(/\/+$/, '')
  if (!trimmed) return DEFAULT_API_BASE
  if (trimmed.endsWith('/api')) return trimmed
  return `${trimmed}/api`
}

const API_BASE = normalizeApiBase(RAW_API_BASE)

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`
  return path
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${normalizePath(path)}`
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET') {
    const csrf = getCookie('atlas_csrf')
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

export const api = {
  register: (payload: { email: string; password: string; remember: boolean }) =>
    request<{ user: ApiUser }>('auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string; remember: boolean }) =>
    request<{ user: ApiUser }>('auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>('auth/logout', { method: 'POST' }),
  me: () => request<{ user: ApiUser }>('auth/me'),
  updateAccount: (payload: { email?: string; current_password?: string; new_password?: string }) =>
    request<{ user: ApiUser }>('auth/account', { method: 'PATCH', body: JSON.stringify(payload) }),
  health: () => request<{ status: string }>('health'),
  quickAuthCheck: async () => {
    await api.health()
    return api.me()
  },
  getState: () => request<any>('state'),
  saveTemplate: (payload: { name: string; data: Record<string, any> }) =>
    request('state/template', { method: 'PUT', body: JSON.stringify(payload) }),
  saveReport: (payload: { name: string; data: Record<string, any> }) =>
    request('state/report', { method: 'PUT', body: JSON.stringify(payload) }),
  saveSettings: (payload: { name: string; data: Record<string, any> }) =>
    request('state/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  createImport: (payload: { name: string; kind: string; status: string; metadata: Record<string, any> }) =>
    request('state/imports', { method: 'POST', body: JSON.stringify(payload) }),
  listSnapshots: () => request<SnapshotListItem[]>('snapshots'),
  createSnapshot: (payload: { name: string; payload: SnapshotPayload }) =>
    request<any>('snapshots', { method: 'POST', body: JSON.stringify(payload) }),
  getSnapshot: (snapshotId: string) => request<any>(`snapshots/${snapshotId}`),
  updateSnapshot: (snapshotId: string, payload: any) =>
    request<any>(`snapshots/${snapshotId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  duplicateSnapshot: (snapshotId: string) =>
    request<any>(`snapshots/${snapshotId}/duplicate`, { method: 'POST' }),
  deleteSnapshot: (snapshotId: string) => request<{ ok: boolean }>(`snapshots/${snapshotId}`, { method: 'DELETE' }),
  listShares: (snapshotId: string) => request<any[]>(`snapshots/${snapshotId}/shares`),
  createShare: (snapshotId: string, payload: { email: string; role: string }) =>
    request<any>(`snapshots/${snapshotId}/shares`, { method: 'POST', body: JSON.stringify(payload) }),
  updateShare: (snapshotId: string, shareId: string, payload: { role: string }) =>
    request<any>(`snapshots/${snapshotId}/shares/${shareId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteShare: (snapshotId: string, shareId: string) =>
    request<{ ok: boolean }>(`snapshots/${snapshotId}/shares/${shareId}`, { method: 'DELETE' }),
  listUsers: () => request<{ id: string; email: string; role: string; created_at: string }[]>('users'),
  createUser: (payload: { email: string; password: string; role?: string }) =>
    request<{ id: string; email: string; role: string; created_at: string }>('users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserRole: (userId: string, payload: { role: string }) =>
    request<{ id: string; email: string; role: string; created_at: string }>(`users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (userId: string) =>
    request<{ ok: boolean }>(`users/${userId}`, { method: 'DELETE' }),
  listTxnOverrides: () => request<TxnOverride[]>('ledger/overrides'),
  upsertTxnOverride: (payload: {
    source: string
    document_id: string
    line_item_id?: string | null
    hash?: string | null
    treatment: string
    deferral_start_month?: string | null
    deferral_months?: number | null
    deferral_include_in_operating_kpis?: boolean | null
  }) => request<TxnOverride>('ledger/overrides', { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTxnOverride: (overrideId: string) => request<{ ok: boolean }>(`ledger/overrides/${overrideId}`, { method: 'DELETE' }),
  listDoctorRules: () => request<DoctorRule[]>('ledger/doctor-rules'),
  upsertDoctorRule: (payload: {
    contact_id: string
    default_treatment: string
    deferral_start_month?: string | null
    deferral_months?: number | null
    deferral_include_in_operating_kpis?: boolean | null
    enabled: boolean
  }) => request<DoctorRule>('ledger/doctor-rules', { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDoctorRule: (contactId: string) => request<{ ok: boolean }>(`ledger/doctor-rules/${contactId}`, { method: 'DELETE' }),
  getPreference: (key: string) => request<UserPreference | null>(`ledger/preferences/${key}`),
  upsertPreference: (key: string, payload: { value_json: Record<string, any> }) =>
    request<UserPreference>(`ledger/preferences/${key}`, { method: 'PUT', body: JSON.stringify(payload) }),
  xeroStatus: () => request<XeroStatus>('xero/status'),
  xeroAuthorize: () => request<{ url: string }>('xero/authorize'),
  xeroTenants: () => request<XeroTenant[]>('xero/tenants'),
  xeroSelectTenant: (tenantId: string) =>
    request<{ ok: boolean; tenantId: string }>('xero/tenant', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId }) }),
  xeroSync: (payload: { from_date: string; to_date: string; include_gl: boolean }) =>
    request<{ pl: any; gl: any | null; tenantId: string }>('xero/sync', { method: 'POST', body: JSON.stringify(payload) }),
}

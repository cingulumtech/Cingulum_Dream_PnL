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

export type TxnOverridePayload = {
  source: string
  document_id: string
  line_item_id?: string | null
  hash?: string | null
  treatment: string
  deferral_start_month?: string | null
  deferral_months?: number | null
  deferral_include_in_operating_kpis?: boolean | null
}

export type DoctorRulePayload = {
  contact_id: string
  default_treatment: string
  deferral_start_month?: string | null
  deferral_months?: number | null
  deferral_include_in_operating_kpis?: boolean | null
  enabled: boolean
}

export type UserPreferencePayload = {
  value_json: Record<string, any>
}

const API_URL = import.meta.env.VITE_API_URL ?? ''

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`
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
  register: (payload: { email: string; password: string; remember: boolean; invite_code?: string }) =>
    request<{ user: ApiUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string; remember: boolean }) =>
    request<{ user: ApiUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: ApiUser }>('/api/auth/me'),
  getState: () => request<any>('/api/state'),
  saveTemplate: (payload: { name: string; data: Record<string, any> }) =>
    request('/api/state/template', { method: 'PUT', body: JSON.stringify(payload) }),
  saveReport: (payload: { name: string; data: Record<string, any> }) =>
    request('/api/state/report', { method: 'PUT', body: JSON.stringify(payload) }),
  saveSettings: (payload: { name: string; data: Record<string, any> }) =>
    request('/api/state/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  createImport: (payload: { name: string; kind: string; status: string; metadata: Record<string, any> }) =>
    request('/api/state/imports', { method: 'POST', body: JSON.stringify(payload) }),
  listSnapshots: () => request<SnapshotListItem[]>('/api/snapshots'),
  createSnapshot: (payload: { name: string; payload: SnapshotPayload }) =>
    request<any>('/api/snapshots', { method: 'POST', body: JSON.stringify(payload) }),
  getSnapshot: (snapshotId: string) => request<any>(`/api/snapshots/${snapshotId}`),
  updateSnapshot: (snapshotId: string, payload: any) =>
    request<any>(`/api/snapshots/${snapshotId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  duplicateSnapshot: (snapshotId: string) =>
    request<any>(`/api/snapshots/${snapshotId}/duplicate`, { method: 'POST' }),
  deleteSnapshot: (snapshotId: string) => request<{ ok: boolean }>(`/api/snapshots/${snapshotId}`, { method: 'DELETE' }),
  listShares: (snapshotId: string) => request<any[]>(`/api/snapshots/${snapshotId}/shares`),
  createShare: (snapshotId: string, payload: { email: string; role: string }) =>
    request<any>(`/api/snapshots/${snapshotId}/shares`, { method: 'POST', body: JSON.stringify(payload) }),
  updateShare: (snapshotId: string, shareId: string, payload: { role: string }) =>
    request<any>(`/api/snapshots/${snapshotId}/shares/${shareId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteShare: (snapshotId: string, shareId: string) =>
    request<{ ok: boolean }>(`/api/snapshots/${snapshotId}/shares/${shareId}`, { method: 'DELETE' }),
  listUsers: () => request<{ id: string; email: string; role: string; created_at: string }[]>('/api/users'),
  updateUserRole: (userId: string, payload: { role: string }) =>
    request<{ id: string; email: string; role: string; created_at: string }>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  listTxnOverrides: () => request<any[]>('/api/ledger/overrides'),
  upsertTxnOverride: (payload: TxnOverridePayload) =>
    request<any>('/api/ledger/overrides', { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTxnOverride: (overrideId: string) =>
    request<{ ok: boolean }>(`/api/ledger/overrides/${overrideId}`, { method: 'DELETE' }),
  listDoctorRules: () => request<any[]>('/api/ledger/doctor-rules'),
  upsertDoctorRule: (payload: DoctorRulePayload) =>
    request<any>('/api/ledger/doctor-rules', { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDoctorRule: (contactId: string) =>
    request<{ ok: boolean }>(`/api/ledger/doctor-rules/${contactId}`, { method: 'DELETE' }),
  getPreference: (key: string) => request<any | null>(`/api/ledger/preferences/${key}`),
  upsertPreference: (key: string, payload: UserPreferencePayload) =>
    request<any>(`/api/ledger/preferences/${key}`, { method: 'PUT', body: JSON.stringify(payload) }),
}

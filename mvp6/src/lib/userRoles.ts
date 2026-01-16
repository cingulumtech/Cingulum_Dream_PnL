export const USER_ROLE_OPTIONS = ['view', 'edit', 'admin', 'super_admin'] as const

export type UserRole = (typeof USER_ROLE_OPTIONS)[number]

const ROLE_ALIASES: Record<string, UserRole> = {
  viewer: 'view',
  editor: 'edit',
}

export function normalizeUserRole(role?: string | null): UserRole | undefined {
  if (!role) return undefined
  return ROLE_ALIASES[role] ?? (role as UserRole)
}

export function isReadOnlyRole(role?: string | null): boolean {
  return normalizeUserRole(role) === 'view'
}

export function canManageUsers(role?: string | null): boolean {
  const normalized = normalizeUserRole(role)
  return normalized === 'admin' || normalized === 'super_admin'
}

export function canDeleteUsers(role?: string | null): boolean {
  return normalizeUserRole(role) === 'super_admin'
}

export function displayUserRole(role?: string | null): string {
  const normalized = normalizeUserRole(role)
  if (!normalized) return 'unknown'
  return normalized.replace('_', ' ')
}

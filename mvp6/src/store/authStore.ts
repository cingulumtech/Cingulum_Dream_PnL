import { create } from 'zustand'
import { ApiUser } from '../lib/api'

type AuthState = {
  user: ApiUser | null
  status: 'unknown' | 'authenticated' | 'unauthenticated'
  setUser: (user: ApiUser | null) => void
  setStatus: (status: AuthState['status']) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
}))

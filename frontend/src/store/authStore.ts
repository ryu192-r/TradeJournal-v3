import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import apiClient, { clearAuthState } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

export interface AuthUser {
  id: number
  email: string
  full_name: string
  is_active: boolean
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name?: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  setToken: (token: string | null) => void
  clearError: () => void
  error: string | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          queryClient.clear()
          const { data } = await apiClient.post('/auth/login', { email, password })
          const { access_token, refresh_token } = data
          localStorage.setItem('auth_token', access_token)
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token)
          }
          set({ token: access_token })
          await get().fetchMe()
        } catch (err: any) {
          const message = err?.response?.data?.detail ?? 'Login failed. Please try again.'
          set({ error: message })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      register: async (email: string, password: string, full_name?: string) => {
        set({ isLoading: true, error: null })
        try {
          queryClient.clear()
          const { data } = await apiClient.post('/auth/register', { email, password, full_name })
          const { access_token, refresh_token } = data
          localStorage.setItem('auth_token', access_token)
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token)
          }
          set({ token: access_token })
          await get().fetchMe()
        } catch (err: any) {
          const message = err?.response?.data?.detail ?? 'Registration failed.'
          set({ error: message })
          throw err
        } finally {
          set({ isLoading: false })
        }
      },

      logout: async () => {
        const refreshToken = localStorage.getItem('refresh_token')
        try {
          if (refreshToken) {
            await apiClient.post('/auth/logout', { refresh_token: refreshToken })
          }
        } catch {
          // Server logout failed — clear local state anyway
        }
        clearAuthState()
        set({ user: null, isAuthenticated: false, token: null })
      },

      fetchMe: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          set({ user: null, isAuthenticated: false, token: null })
          return
        }
        try {
          const { data } = await apiClient.get<AuthUser>('/auth/me')
          set({ user: data, isAuthenticated: true })
        } catch {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('refresh_token')
          queryClient.clear()
          set({ user: null, isAuthenticated: false, token: null })
        }
      },

      clearError: () => set({ error: null }),
      setToken: (token: string | null) => set({ token }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          state.fetchMe()
        }
      },
    }
  )
)
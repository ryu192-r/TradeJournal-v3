import axios from 'axios'
import { mark, measure } from '@/utils/performance'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/logout-all']

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else if (token) p.resolve(token)
  })
  failedQueue = []
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return AUTH_ENDPOINTS.some((ep) => url.includes(ep))
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const timingKey = `api:${config.method?.toUpperCase() ?? 'GET'} ${config.url ?? 'unknown'}`
  ;(config as unknown as Record<string, unknown>)._timingKey = timingKey
  mark(`${timingKey}:start`)
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const timingKey = (response.config as unknown as Record<string, unknown>)._timingKey as string | undefined
    if (timingKey) {
      mark(`${timingKey}:end`)
      measure(timingKey, `${timingKey}:start`, `${timingKey}:end`)
    }
    return response
  },
  async (error) => {
    const timingKey = (error.config as unknown as Record<string, unknown> | undefined)?._timingKey as string | undefined
    if (timingKey) {
      mark(`${timingKey}:end`)
      measure(timingKey, `${timingKey}:start`, `${timingKey}:end`)
    }
    const originalRequest = error.config
    const requestUrl = originalRequest?.url

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(requestUrl)
    ) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        queryClient.clear()
        useAuthStore.getState().setToken(null)
        window.location.reload()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const newAccessToken = data.access_token
        localStorage.setItem('auth_token', newAccessToken)
        localStorage.setItem('refresh_token', data.refresh_token)
        useAuthStore.getState().setToken(newAccessToken)
        processQueue(null, newAccessToken)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        queryClient.clear()
        useAuthStore.getState().setToken(null)
        window.location.reload()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export function clearAuthState() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
  queryClient.clear()
}

export default apiClient
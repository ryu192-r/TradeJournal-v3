import axios from 'axios'
import { mark, measure } from '@/utils/performance'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

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

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const timingKey = `api:${config.method?.toUpperCase() ?? 'GET'} ${config.url ?? 'unknown'}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(config as any)._timingKey = timingKey
  mark(`${timingKey}:start`)
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timingKey = (response.config as any)._timingKey as string | undefined
    if (timingKey) {
      mark(`${timingKey}:end`)
      measure(timingKey, `${timingKey}:start`, `${timingKey}:end`)
    }
    return response
  },
  async (error) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timingKey = (error.config as any)._timingKey as string | undefined
    if (timingKey) {
      mark(`${timingKey}:end`)
      measure(timingKey, `${timingKey}:start`, `${timingKey}:end`)
    }
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/'
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
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token)
        }
        processQueue(null, newAccessToken)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient

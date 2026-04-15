import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth'

const viteEnv = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
const API_BASE = viteEnv.VITE_API_URL?.trim() || '/api'

const unwrap = <T>(res: AxiosResponse<T>): T => res.data

function readDetailMessage(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail
  }

  if (detail && typeof detail === 'object') {
    const message = (detail as { error?: unknown }).error
    return typeof message === 'string' ? message : null
  }

  return null
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const axiosError = error as AxiosError<{
    error?: string
    detail?: unknown
    fields?: Record<string, string>
  }>

  const payload = axiosError.response?.data
  if (!payload) {
    return fallback
  }

  if (typeof payload.error === 'string') {
    if (payload.error === 'forbidden') {
      return 'You do not have permission to perform this action.'
    }
    return payload.error
  }

  const detailMessage = readDetailMessage(payload.detail)
  if (detailMessage) {
    if (detailMessage === 'forbidden') {
      return 'You do not have permission to perform this action.'
    }
    return detailMessage
  }

  if (payload.fields && typeof payload.fields === 'object') {
    const messages = Object.entries(payload.fields)
      .map(([field, message]) => `${field}: ${message}`)
      .join(' ')
    if (messages) {
      return messages
    }
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  return fallback
}

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError<{ detail?: string | { error?: string } }>) => {
    const requestUrl = String(err.config?.url || '')
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register')

    if (isAuthEndpoint) {
      return Promise.reject(err)
    }

    const status = err.response?.status
    const detail = err.response?.data?.detail
    const detailUnauthorized = typeof detail === 'object' && detail?.error === 'unauthorized'
    const isNotAuthenticated =
      status === 401 ||
      (status === 403 && (detail === 'Not authenticated' || detailUnauthorized))

    if (isNotAuthenticated) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data).then(unwrap),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then(unwrap),
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
}

export interface ProjectWithTasks extends Project {
  tasks: Task[]
}

export const projectsApi = {
  list: (page = 1, limit = 2) =>
    api.get<{ projects: Project[]; total: number; page: number; limit: number }>(
      `/projects?page=${page}&limit=${limit}`
    ).then(unwrap),
  create: (data: { name: string; description?: string }) =>
    api.post<Project>('/projects', data).then(unwrap),
  get: (id: string) =>
    api.get<ProjectWithTasks>(`/projects/${id}`).then(unwrap),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Project>(`/projects/${id}`, data).then(unwrap),
  delete: (id: string) => api.delete(`/projects/${id}`),
  stats: (id: string) =>
    api.get<{ total: number; by_status: Record<string, number>; by_assignee: Record<string, number> }>(
      `/projects/${id}/stats`
    ).then(unwrap),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  project_id: string
  assignee_id: string | null
  created_by_id: string
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface PaginatedTasks {
  tasks: Task[]
  total: number
  page: number
  limit: number
}

export const tasksApi = {
  list: (projectId: string, params?: { status?: TaskStatus; assignee?: string | 'unassigned'; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.assignee) q.set('assignee', params.assignee)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    return api.get<PaginatedTasks>(`/projects/${projectId}/tasks?${q}`).then(unwrap)
  },
  create: (projectId: string, data: Partial<Task> & { title: string }) =>
    api.post<Task>(`/projects/${projectId}/tasks`, data).then(unwrap),
  update: (id: string, data: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee_id' | 'due_date'>>) =>
    api.patch<Task>(`/tasks/${id}`, data).then(unwrap),
  delete: (id: string) => api.delete(`/tasks/${id}`),
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => api.get<User[]>('/users').then(unwrap),
}

import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, tasksApi, usersApi, type Task, type TaskStatus, getApiErrorMessage } from '@/lib/api'
import { Navbar } from '@/components/Navbar'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { Loader2, Plus, ArrowLeft, Pencil, Check, X, Trash2, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/store/auth'

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: 'border-slate-300 dark:border-slate-700' },
  { key: 'in_progress', label: 'In Progress', color: 'border-blue-400 dark:border-blue-600' },
  { key: 'done', label: 'Done', color: 'border-green-400 dark:border-green-600' },
]

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [filter, setFilter] = useState<TaskStatus | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 6
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [dragTask, setDragTask] = useState<Task | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [taskActionError, setTaskActionError] = useState<string | null>(null)

  const { data: project, isLoading, isError, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id && hasHydrated && isAuthenticated,
    retry: false,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: hasHydrated && isAuthenticated,
  })

  const tasksQueryKey = ['tasks', id ?? '', filter, assigneeFilter, page, pageSize] as const
  const { data: tasksData, isLoading: isTasksLoading, isError: isTasksError, error: tasksError } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: () => tasksApi.list(id!, {
      status: filter || undefined,
      assignee: assigneeFilter || undefined,
      page,
      limit: pageSize,
    }),
    enabled: !!id && hasHydrated && isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (isError) {
      setLoadError(getApiErrorMessage(projectError, 'Project not found or failed to load.'))
    }
  }, [isError, projectError])

  useEffect(() => {
    if (isTasksError) {
      setTaskActionError(getApiErrorMessage(tasksError, 'Failed to load tasks.'))
    }
  }, [isTasksError, tasksError])

  const { data: stats } = useQuery({
    queryKey: ['project-stats', id],
    queryFn: () => projectsApi.stats(id!),
    enabled: !!id && hasHydrated && isAuthenticated,
  })

  useEffect(() => {
    if (!id || !token) {
      return
    }

    const sse = new EventSource(`/api/events/tasks?token=${encodeURIComponent(token)}`)
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { project_id?: string }
        if (payload.project_id && payload.project_id !== id) {
          return
        }
      } catch {
        return
      }

      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
    }

    return () => {
      sse.close()
    }
  }, [id, token, queryClient])

  const { register: registerName, handleSubmit: handleNameSubmit, reset: resetName } = useForm<{ name: string; description: string }>()

  const { mutate: updateProject } = useMutation({
    mutationFn: (data: { name?: string; description?: string }) => projectsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingName(false)
    },
    onError: (err) => {
      setTaskActionError(getApiErrorMessage(err, 'Failed to save project.'))
    },
  })

  const { mutate: deleteProject, isPending: deletePending } = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => navigate('/projects'),
  })

  const { mutate: deleteTask } = useMutation({
    mutationFn: (task: Task) => tasksApi.delete(task.id),
    onSuccess: () => {
      setTaskActionError(null)
      if ((tasksData?.tasks.length ?? 0) <= 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1))
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
    },
    onError: (err) => {
      setTaskActionError(getApiErrorMessage(err, 'Failed to delete task.'))
    },
  })

  const { mutate: moveTaskStatus } = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => tasksApi.update(taskId, { status }),
    onSuccess: () => {
      setTaskActionError(null)
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
    },
    onError: (err) => {
      setTaskActionError(getApiErrorMessage(err, 'Failed to update task status.'))
    },
  })

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </div>
  )

  if (isError || !project) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-destructive font-medium">{loadError ?? 'Project not found or failed to load.'}</p>
        <Link to="/projects" className="mt-4 text-sm text-primary hover:underline">← Back to Projects</Link>
      </div>
    </div>
  )

  const totalTasks = tasksData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize))
  const taskRows = tasksData?.tasks ?? []

  const userNameById = (users ?? []).reduce<Record<string, string>>((acc, user) => {
    acc[user.id] = user.name
    return acc
  }, {})

  const assigneeOptions = users ?? []

  function startEdit() {
    resetName({ name: project!.name, description: project!.description ?? '' })
    setEditingName(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Projects
        </Link>

        {/* Project header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <form onSubmit={handleNameSubmit((v) => updateProject(v))} className="space-y-2">
                <input
                  id="edit-project-name"
                  {...registerName('name', { required: true })}
                  className="w-full text-2xl font-bold bg-transparent border-b-2 border-primary text-foreground focus:outline-none pb-1"
                  autoFocus
                />

                {taskActionError && (
                  <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {taskActionError}
                  </div>
                )}
                <textarea
                  id="edit-project-description"
                  {...registerName('description')}
                  rows={2}
                  className="w-full text-sm text-muted-foreground bg-transparent border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Description…"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button type="button" onClick={() => setEditingName(false)} className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs font-medium">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground truncate">{project.name}</h1>
                  <button id="edit-project-btn" onClick={startEdit} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
              </>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {showDeleteConfirm ? (
              <>
                <button onClick={() => deleteProject()} disabled={deletePending} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90">
                  {deletePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirm Delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent">Cancel</button>
              </>
            ) : (
              <button id="delete-project-detail-btn" onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              id="add-task-btn"
              onClick={() => { setEditingTask(null); setShowTaskModal(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {taskActionError && (
          <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {taskActionError}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {STATUS_COLUMNS.map(({ key, label, color }) => {
            const count = stats?.by_status?.[key] ?? 0
            return (
              <button
                key={key}
                id={`filter-${key}`}
                onClick={() => {
                  setFilter(filter === key ? '' : key)
                  setPage(1)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                }}
                onDrop={() => {
                  if (!dragTask || dragTask.status === key) return
                  moveTaskStatus({ taskId: dragTask.id, status: key })
                  setDragTask(null)
                }}
                className={cn(
                  'text-left p-3 rounded-xl border-t-4 bg-card hover:bg-accent/50 transition-all',
                  color,
                  filter === key ? 'ring-2 ring-primary/50' : ''
                )}
              >
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </button>
            )
          })}
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Assignee:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All</option>
              <option value="unassigned">Unassigned</option>
              {assigneeOptions.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted-foreground">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</p>
        </div>

        {/* Filter pill */}
        {filter && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <button
              onClick={() => {
                setFilter('')
                setPage(1)
              }}
              className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {STATUS_COLUMNS.find((c) => c.key === filter)?.label}
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Tasks grid */}
        {isTasksLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : taskRows.length === 0 ? (
          <div className="text-center py-20">
            <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {totalTasks > 0 ? 'No tasks on this page' : (filter ? `No ${STATUS_COLUMNS.find((c) => c.key === filter)?.label} tasks` : 'No tasks yet')}
            </p>
            {!filter && (
              <button
                onClick={() => { setEditingTask(null); setShowTaskModal(true) }}
                className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Add first task
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {taskRows.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projectId={id!}
                  tasksQueryKey={tasksQueryKey}
                  assigneeName={task.assignee_id ? userNameById[task.assignee_id] : undefined}
                  onDragStart={(t) => setDragTask(t)}
                  onEdit={(t) => { setEditingTask(t); setShowTaskModal(true) }}
                  onDelete={(t) => deleteTask(t)}
                  onError={setTaskActionError}
                />
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * pageSize + 1, totalTasks)} to {Math.min(page * pageSize, totalTasks)} of {totalTasks}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-2 rounded-lg bg-muted text-sm text-foreground">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {showTaskModal && (
        <TaskModal
          projectId={id!}
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
        />
      )}
    </div>
  )
}

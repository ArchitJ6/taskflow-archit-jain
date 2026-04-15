import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { type Task, type TaskStatus, type TaskPriority, tasksApi, usersApi, getApiErrorMessage } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskModalProps {
  projectId: string
  task?: Task | null
  onClose: () => void
}

interface FormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string
  due_date: string
}

export function TaskModal({ projectId, task, onClose }: TaskModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!task

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      assignee_id: task?.assignee_id ?? '',
      due_date: task?.due_date ?? '',
    },
  })

  useEffect(() => {
    if (task) reset({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id ?? '',
      due_date: task.due_date ?? '',
    })
  }, [task, reset])

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assignee_id: values.assignee_id || undefined,
        due_date: values.due_date || undefined,
      }
      return isEdit ? tasksApi.update(task!.id, payload) : tasksApi.create(projectId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      onClose()
    },
  })

  function onSubmit(values: FormValues) { mutate(values) }

  // Get error message from API
  const apiError = getApiErrorMessage(error, 'Failed to save task.')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button id="close-task-modal" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {apiError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="task-title"
              {...register('title', { required: 'Title is required' })}
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                errors.title ? 'border-destructive' : 'border-input hover:border-primary/50'
              )}
              placeholder="Task title…"
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-description">
              Description
            </label>
            <textarea
              id="task-description"
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 resize-none"
              placeholder="Optional description…"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-status">Status</label>
              <select
                id="task-status"
                {...register('status')}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                {...register('priority')}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              {...register('assignee_id')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Unassigned</option>
              {(users ?? []).map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="task-due-date">Due Date</label>
            <input
              id="task-due-date"
              type="date"
              {...register('due_date')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-task"
              type="submit"
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

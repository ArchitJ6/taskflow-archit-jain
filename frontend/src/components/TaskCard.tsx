import { cn } from '@/lib/utils'
import { type TaskStatus, type TaskPriority, type Task, tasksApi, getApiErrorMessage } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, ArrowRight, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

interface TaskCardProps {
  task: Task
  projectId: string
  tasksQueryKey: ReadonlyArray<string | number>
  assigneeName?: string
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onDragStart?: (task: Task) => void
  onError?: (message: string) => void
}

export function TaskCard({ task, projectId, tasksQueryKey, assigneeName, onEdit, onDelete, onDragStart, onError }: TaskCardProps) {
  const queryClient = useQueryClient()

  // Optimistic status toggle
  const { mutate: toggleStatus, isPending } = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: NEXT_STATUS[task.status] }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey })
      // Snapshot for rollback
      const prev = queryClient.getQueryData(tasksQueryKey)
      // Optimistic update
      queryClient.setQueryData(tasksQueryKey, (old: any) => {
        if (!old) return old
        return {
          ...old,
          tasks: old.tasks.map((t: Task) =>
            t.id === task.id ? { ...t, status: NEXT_STATUS[task.status] } : t
          ),
        }
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(tasksQueryKey, ctx.prev)
      onError?.(getApiErrorMessage(_err, 'Failed to update task.'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  return (
    <div
      className="group relative bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200 animate-fade-in"
      draggable
      onDragStart={() => onDragStart?.(task)}
    >
      {/* Priority strip */}
      <div className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-r-full', {
        'bg-gray-300': task.priority === 'low',
        'bg-yellow-400': task.priority === 'medium',
        'bg-red-500': task.priority === 'high',
      })} />

      <div className="pl-3">
        {/* Title + actions */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{task.title}</h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              id={`edit-task-${task.id}`}
              onClick={() => onEdit(task)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs"
            >
              Edit
            </button>
            <button
              id={`delete-task-${task.id}`}
              onClick={() => onDelete(task)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs"
            >
              Del
            </button>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        {/* Metadata row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Status badge — click to advance */}
          <button
            id={`toggle-status-${task.id}`}
            onClick={() => toggleStatus()}
            disabled={isPending}
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer transition-all hover:scale-105',
              STATUS_COLORS[task.status]
            )}
            title="Click to advance status"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : (
              <>
                {STATUS_LABELS[task.status]}
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>

          {/* Priority */}
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', PRIORITY_COLORS[task.priority])}>
            {task.priority}
          </span>

          {/* Due date */}
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}

          {/* Assignee indicator */}
          {task.assignee_id && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              {assigneeName ?? 'Assigned'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

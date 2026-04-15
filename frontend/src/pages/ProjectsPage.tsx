import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, type Project } from '@/lib/api'
import { Navbar } from '@/components/Navbar'
import { Plus, FolderOpen, Loader2, ChevronRight, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useAuthStore } from '@/store/auth'
import { getApiErrorMessage } from '@/lib/api'

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  interface FormValues {
    name: string
    description: string
  }
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()
  const [apiError, setApiError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
    onError: (err: unknown) => {
      setApiError(getApiErrorMessage(err, 'Failed to create project'))
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 animate-fade-in">
        <h2 className="text-lg font-semibold text-foreground mb-4">New Project</h2>
        {apiError && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">{apiError}</div>
        )}
        <form onSubmit={handleSubmit((values: FormValues) => mutate(values))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="project-name">Name *</label>
            <input
              id="project-name"
              {...register('name', { required: 'Name is required' })}
              className={cn('w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50', errors.name ? 'border-destructive' : 'border-input hover:border-primary/50')}
              placeholder="My project"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 resize-none"
              placeholder="Optional description…"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">Cancel</button>
            <button id="submit-project" type="submit" disabled={isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectCard({ project, onDeleteSuccess }: { project: Project; onDeleteSuccess?: () => void }) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { mutate: deleteProject } = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onDeleteSuccess?.()
    },
  })

  return (
    <div className="group bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all duration-200 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/projects/${project.id}`} className="group/link flex items-center gap-1">
            <h3 className="font-semibold text-foreground group-hover/link:text-primary transition-colors truncate">{project.name}</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/link:text-primary transition-colors shrink-0" />
          </Link>
          {project.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{project.description}</p>}
          <p className="mt-2 text-xs text-muted-foreground/60">
            Created {format(new Date(project.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        {/* Delete button */}
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={() => deleteProject()} className="text-xs px-2 py-1 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors">Cancel</button>
            </div>
          ) : (
            <button id={`delete-project-${project.id}`} onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const pageSize = 2
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['projects', page],
    queryFn: () => projectsApi.list(page, pageSize),
    enabled: hasHydrated && isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (isError) {
      setLoadError(getApiErrorMessage(error, 'Failed to load projects.'))
    }
  }, [error, isError])

  const resolvedTotalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))
  const currentPage = Math.min(page, resolvedTotalPages)

  function handleProjectDeleted() {
    if (page > 1 && (data?.projects.length ?? 0) <= 1) {
      setPage((current) => Math.max(1, current - 1))
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data ? `${data.total} project${data.total !== 1 ? 's' : ''}` : 'Your workspace'}
            </p>
          </div>
          <button
            id="new-project-btn"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <div className="text-center py-24">
            <p className="text-destructive font-medium">{loadError ?? 'Failed to load projects.'}</p>
            <p className="text-sm text-muted-foreground mt-1">Check your connection and try refreshing.</p>
          </div>
        )}

        {data && data.projects.length === 0 && (
          <div className="text-center py-24">
            <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">No projects yet</h2>
            <p className="text-sm text-muted-foreground mt-1">Create your first project to get started.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Create Project
            </button>
          </div>
        )}

        {data && data.projects.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDeleteSuccess={handleProjectDeleted} />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * pageSize + 1, data.total)}
                {' '}
                to {Math.min(currentPage * pageSize, data.total)} of {data.total}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-2 rounded-lg bg-muted text-sm text-foreground">
                  Page {currentPage} of {resolvedTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(resolvedTotalPages, current + 1))}
                  disabled={currentPage >= resolvedTotalPages}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

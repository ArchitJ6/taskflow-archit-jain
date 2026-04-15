import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Loader2, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormValues {
  email: string
  password: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { login } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()
  const [apiError, setApiError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login(data.token, data.user)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
    onError: (err: any) => {
      setApiError(getApiErrorMessage(err, 'Login failed. Please try again.'))
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    mutate(values)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <CheckSquare className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your TaskFlow account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 animate-fade-in">
          {apiError && (
            <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                {...register('email', { required: 'Email is required' })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.email ? 'border-destructive' : 'border-input hover:border-primary/50'
                )}
                placeholder="you@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                {...register('password', { required: 'Password is required' })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.password ? 'border-destructive' : 'border-input hover:border-primary/50'
                )}
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>

        {/* Test credentials hint */}
        <div className="mt-4 bg-muted/50 border border-border rounded-xl p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">🔑 Test credentials</p>
          <p>Email: <span className="font-mono">test@example.com</span></p>
          <p>Password: <span className="font-mono">password123</span></p>
        </div>
      </div>
    </div>
  )
}

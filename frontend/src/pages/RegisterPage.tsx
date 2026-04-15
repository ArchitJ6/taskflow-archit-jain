import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, getApiErrorMessage, type AuthResponse } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Loader2, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormValues {
  name: string
  email: string
  password: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { login } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()
  const [apiError, setApiError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation<AuthResponse, unknown, FormValues>({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      login(data.token, data.user)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
    onError: (err: unknown) => {
      const message = getApiErrorMessage(err, 'Registration failed. Please try again.')
      setApiError(
        message
          .split(' ')
          .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
          .join(' ')
      )
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
          <h1 className="text-3xl font-bold text-foreground">Create account</h1>
          <p className="mt-2 text-muted-foreground">Start managing tasks with TaskFlow</p>
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
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="register-name">
                Full Name
              </label>
              <input
                id="register-name"
                {...register('name', { required: 'Name is required' })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.name ? 'border-destructive' : 'border-input hover:border-primary/50'
                )}
                placeholder="Jane Doe"
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
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
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="register-password">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border bg-background text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  errors.password ? 'border-destructive' : 'border-input hover:border-primary/50'
                )}
                placeholder="Min. 8 characters"
              />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

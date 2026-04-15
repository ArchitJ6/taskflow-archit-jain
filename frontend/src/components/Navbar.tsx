import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Moon, Sun, CheckSquare } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('taskflow-theme') === 'dark' ||
      (!localStorage.getItem('taskflow-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('taskflow-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('taskflow-theme', 'light')
    }
  }, [dark])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/projects" className="flex items-center gap-2 font-bold text-lg text-foreground hover:text-primary transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          TaskFlow
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/projects"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Projects
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Dark mode */}
          <button
            onClick={() => setDark(!dark)}
            id="dark-mode-toggle"
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User badge */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex w-8 h-8 rounded-full bg-primary/20 items-center justify-center text-primary font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground">{user.name}</span>
            </div>
          )}

          {/* Logout */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}

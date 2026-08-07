import { useState } from 'react'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import { useTheme } from './hooks/useTheme'

type Page = 'login' | 'signup' | 'dashboard'
interface User { name: string; vehicleId: string; city: string; age?: number }

export default function App() {
  const [page, setPage] = useState<Page>('login')
  const [user, setUser] = useState<User | null>(null)
  const { theme, toggleTheme } = useTheme()

  const handleLogin = (driver: User) => {
    setUser(driver)
    setPage('dashboard')
  }

  const handleSignUp = (data: { name: string; vehicleId: string; city: string }) => {
    // After sign-up, send back to login with a success hint
    setPage('login')
  }

  const handleLogout = () => {
    setUser(null)
    setPage('login')
  }

  if (page === 'signup') return <SignUp onSignUp={handleSignUp} onBack={() => setPage('login')} theme={theme} onToggleTheme={toggleTheme} />
  if (page === 'dashboard' && user) return <Dashboard user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
  return <Login onLogin={handleLogin} onSignUp={() => setPage('signup')} theme={theme} onToggleTheme={toggleTheme} />
}

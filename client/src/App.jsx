import { useState, useEffect } from 'react'
import { authAPI, apiUtils } from './services/api'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import Dashboard from './components/Dashboard'
import SessionDetail from './components/SessionDetail'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('login') // 'login', 'register', 'dashboard', 'session-detail'
  const [currentSessionId, setCurrentSessionId] = useState(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = apiUtils.getToken()
      if (token) {
        const response = await authAPI.verifyToken()
        setUser(response.user)
        setCurrentView('dashboard')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      apiUtils.clearAuth()
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      apiUtils.setToken(response.token)
      setUser(response.user)
      setCurrentView('dashboard')
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const handleRegister = async (userData) => {
    try {
      const response = await authAPI.register(userData)
      apiUtils.setToken(response.token)
      setUser(response.user)
      setCurrentView('dashboard')
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      apiUtils.clearAuth()
      setUser(null)
      setCurrentView('login')
      setCurrentSessionId(null)
    }
  }

  const handleViewSession = (sessionId) => {
    setCurrentSessionId(sessionId)
    setCurrentView('session-detail')
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setCurrentSessionId(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {currentView === 'login' ? (
          <LoginPage onLoginSuccess={handleLogin} onSwitchToRegister={() => setCurrentView('register')} />
        ) : (
          <RegisterPage onRegisterSuccess={handleRegister} onSwitchToLogin={() => setCurrentView('login')} />
        )}
      </div>
    )
  }

  if (currentView === 'session-detail' && currentSessionId) {
    return (
      <SessionDetail 
        sessionId={currentSessionId} 
        onBack={handleBackToDashboard}
      />
    )
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={handleLogout}
      onViewSession={handleViewSession}
    />
  )
}

export default App

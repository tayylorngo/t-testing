import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { authAPI, apiUtils } from './services/api'
import { RealTimeProvider } from './contexts/RealTimeContext'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import Dashboard from './components/Dashboard'
import SessionDetail from './components/SessionDetail'
import SessionView from './components/SessionView'
import RoomDetail from './components/RoomDetail'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const token = apiUtils.getToken()
      if (token) {
        const response = await authAPI.verifyToken()
        setUser(response.user)
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
      navigate('/dashboard')
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
      navigate('/dashboard')
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
      navigate('/login')
    }
  }

  const handleViewSession = (sessionId, mode = 'manage') => {
    const route = mode === 'view' ? `/session/${sessionId}/view` : `/session/${sessionId}/manage`
    navigate(route)
  }

  const handleBackToDashboard = () => {
    navigate('/dashboard')
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
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLogin} onSwitchToRegister={() => navigate('/register')} />} />
        <Route path="/register" element={<RegisterPage onRegisterSuccess={handleRegister} onSwitchToLogin={() => navigate('/login')} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <RealTimeProvider>
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} onUserUpdated={setUser} onLogout={handleLogout} onViewSession={handleViewSession} />} />
        <Route path="/session/:sessionId/manage" element={<SessionDetail onBack={handleBackToDashboard} />} />
        <Route path="/session/:sessionId/view" element={<SessionView user={user} onBack={handleBackToDashboard} />} />
        <Route path="/sessions/:sessionId/rooms/:roomId" element={<RoomDetail user={user} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </RealTimeProvider>
  )
}

export default App

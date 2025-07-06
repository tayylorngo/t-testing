import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import { authAPI, apiUtils } from './services/api'

function App() {
  const [currentPage, setCurrentPage] = useState('login') // 'login' or 'register'
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken')
        const userData = localStorage.getItem('userData')
        
        if (token && userData) {
          // Try to verify the token with the server
          try {
            await authAPI.verifyToken()
            // If verification succeeds, restore user session
            setUser(JSON.parse(userData))
          } catch {
            // If token is invalid, clear stored data
            console.log('Token verification failed, clearing auth data')
            apiUtils.clearAuth()
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
        apiUtils.clearAuth()
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    // Store user data in localStorage for persistence
    localStorage.setItem('userData', JSON.stringify(userData))
    console.log('User logged in:', userData)
  }

  const handleRegisterSuccess = (data) => {
    // After successful registration, switch to login page
    setCurrentPage('login')
    console.log('Registration successful:', data)
  }

  const switchToLogin = () => {
    setCurrentPage('login')
  }

  const switchToRegister = () => {
    setCurrentPage('register')
  }

  const handleLogout = () => {
    setUser(null)
    apiUtils.clearAuth()
  }

  // Show loading screen while checking authentication
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

  // If user is logged in, show dashboard (placeholder for now)
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome to T-Testing Dashboard</h1>
            <p className="text-gray-600">Hello, {user.firstName} {user.lastName} ({user.username})!</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {currentPage === 'login' ? (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={switchToRegister}
        />
      ) : (
        <RegisterPage 
          onRegisterSuccess={handleRegisterSuccess}
          onSwitchToLogin={switchToLogin}
        />
      )}
    </div>
  )
}

export default App

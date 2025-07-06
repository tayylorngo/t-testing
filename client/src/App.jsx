import { useState } from 'react'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'

function App() {
  const [currentPage, setCurrentPage] = useState('login') // 'login' or 'register'
  const [user, setUser] = useState(null)

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    // Here you would typically redirect to the dashboard
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
            onClick={() => {
              setUser(null)
              localStorage.removeItem('authToken')
              localStorage.removeItem('userData')
            }}
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

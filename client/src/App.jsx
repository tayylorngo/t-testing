import { useState } from 'react'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import './App.css'

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
      <div className="app">
        <div className="dashboard-container">
          <h1>Welcome to T-Testing Dashboard</h1>
          <p>Hello, {user.firstName} {user.lastName} ({user.username})!</p>
          <button 
            onClick={() => {
              setUser(null)
              localStorage.removeItem('authToken')
              localStorage.removeItem('userData')
            }}
            className="logout-button"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
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

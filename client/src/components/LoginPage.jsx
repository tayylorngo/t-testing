import { useState } from 'react'
import { authAPI, apiUtils } from '../services/api'
import './LoginPage.css'

function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.username) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoginMessage('')
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const data = await authAPI.login(formData)
      
      setLoginMessage('Login successful! Redirecting...')
      
      // Store token and user data
      apiUtils.setToken(data.token)
      localStorage.setItem('userData', JSON.stringify(data.user))
      
      // Call the success callback
      if (onLoginSuccess) {
        onLoginSuccess(data.user)
      }
      
    } catch (error) {
      console.error('Login error:', error)
      setLoginMessage(error.message || 'Login failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <h1>T-Testing</h1>
        <p>School Testing Management System</p>
      </div>
      
      <div className="login-card">
        <h2>Administrator Login</h2>
        <p className="login-subtitle">Access testing monitoring dashboard</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className={errors.username ? 'error' : ''}
              placeholder="Enter your username"
              disabled={isLoading}
            />
            {errors.username && <span className="error-message">{errors.username}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? 'error' : ''}
              placeholder="Enter your password"
              disabled={isLoading}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>
          
          {loginMessage && (
            <div className={`message ${loginMessage.includes('successful') ? 'success' : 'error'}`}>
              {loginMessage}
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Need help? Contact your system administrator</p>
          <p>Don't have an account? 
            <button 
              type="button" 
              className="link-button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage 
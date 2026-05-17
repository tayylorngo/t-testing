import { useState } from 'react'

function RegisterPage({ onRegisterSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [registerMessage, setRegisterMessage] = useState('')

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
    
    // First Name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    }
    
    // Last Name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters'
    }
    
    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    } else if (formData.username.length > 30) {
      newErrors.username = 'Username must be less than 30 characters'
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }
    
    // Confirm Password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setRegisterMessage('')
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const registrationData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        username: formData.username,
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      }
      
      // Call the success callback with registration data
      if (onRegisterSuccess) {
        await onRegisterSuccess(registrationData)
        setRegisterMessage('Registration successful! Please sign in with your new account.')
      }
      
    } catch (error) {
      console.error('Registration error:', error)
      setRegisterMessage(error.message || 'Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="el-app-bg flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md el-fade-up">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/25">
              <svg className="h-8 w-8 text-white" viewBox="0 0 32 32" fill="none">
                <rect x="8" y="6" width="2.5" height="20" rx="1.25" fill="white"/>
                <rect x="8" y="6" width="12" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="14.75" width="9" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="23.5" width="12" height="2.5" rx="1.25" fill="white"/>
                <circle cx="24" cy="10" r="2" fill="white" opacity="0.8"/>
                <circle cx="26" cy="22" r="1.5" fill="white" opacity="0.6"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Elmira</h1>
          <p className="mt-1 text-sm text-slate-500">Testing Session Management</p>
        </div>

        {/* Register Card */}
        <div className="el-card p-6 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Create your account</h2>
            <p className="mt-0.5 text-sm text-slate-500">Set up access to the testing platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="el-label">First name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`el-input ${errors.firstName ? 'el-input-error' : ''}`}
                  placeholder="First name"
                  disabled={isLoading}
                />
                {errors.firstName && <span className="el-error">{errors.firstName}</span>}
              </div>

              <div>
                <label htmlFor="lastName" className="el-label">Last name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`el-input ${errors.lastName ? 'el-input-error' : ''}`}
                  placeholder="Last name"
                  disabled={isLoading}
                />
                {errors.lastName && <span className="el-error">{errors.lastName}</span>}
              </div>
            </div>

            <div>
              <label htmlFor="username" className="el-label">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`el-input ${errors.username ? 'el-input-error' : ''}`}
                placeholder="Choose a username"
                disabled={isLoading}
              />
              {errors.username && <span className="el-error">{errors.username}</span>}
            </div>

            <div>
              <label htmlFor="email" className="el-label">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`el-input ${errors.email ? 'el-input-error' : ''}`}
                placeholder="you@school.edu"
                disabled={isLoading}
              />
              {errors.email && <span className="el-error">{errors.email}</span>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="el-label">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`el-input ${errors.password ? 'el-input-error' : ''}`}
                  placeholder="Create a password"
                  disabled={isLoading}
                />
                {errors.password && <span className="el-error">{errors.password}</span>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="el-label">Confirm password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`el-input ${errors.confirmPassword ? 'el-input-error' : ''}`}
                  placeholder="Re-enter password"
                  disabled={isLoading}
                />
                {errors.confirmPassword && <span className="el-error">{errors.confirmPassword}</span>}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.
            </p>

            {registerMessage && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${
                registerMessage.includes('successful')
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                {registerMessage}
              </div>
            )}

            <button
              type="submit"
              className="el-btn el-btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:text-brand-700"
                onClick={onSwitchToLogin}
                disabled={isLoading}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage 
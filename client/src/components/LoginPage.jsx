import { useState } from 'react'
import { authAPI, apiUtils } from '../services/api'

function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  // Forgot password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotErrors, setForgotErrors] = useState({})
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotStep, setForgotStep] = useState('email') // 'email' | 'code' | 'done'

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
      // Call the success callback with credentials
      if (onLoginSuccess) {
        await onLoginSuccess(formData)
        setLoginMessage('Login successful! Redirecting...')
      }
      
    } catch (error) {
      console.error('Login error:', error)
      setLoginMessage(error.message || 'Login failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotSendCode = async (e) => {
    e.preventDefault()
    setForgotMessage('')
    setForgotErrors({})
    const emailTrim = forgotEmail.trim()
    if (!emailTrim) {
      setForgotErrors({ email: 'Email is required' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrim)) {
      setForgotErrors({ email: 'Please enter a valid email address' })
      return
    }
    setForgotLoading(true)
    try {
      await authAPI.forgotPassword(emailTrim)
      setForgotMessage('If an account exists with this email, you will receive a reset code shortly. Check your inbox.')
      setForgotStep('code')
    } catch (err) {
      setForgotMessage(err.message || 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotResetPassword = async (e) => {
    e.preventDefault()
    setForgotMessage('')
    setForgotErrors({})
    const newErrors = {}
    if (!forgotCode.trim()) newErrors.code = 'Enter the code from your email'
    if (!forgotNewPassword) newErrors.newPassword = 'New password is required'
    else if (forgotNewPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters'
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(forgotNewPassword)) newErrors.newPassword = 'Password must contain uppercase, lowercase, and a number'
    if (forgotNewPassword !== forgotConfirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    if (Object.keys(newErrors).length > 0) {
      setForgotErrors(newErrors)
      return
    }
    setForgotLoading(true)
    try {
      await authAPI.resetPassword(forgotEmail.trim().toLowerCase(), forgotCode.trim(), forgotNewPassword)
      setForgotMessage('Password has been reset. You can sign in with your new password.')
      setForgotStep('done')
    } catch (err) {
      setForgotMessage(err.message || 'Unable to reset password. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotPassword = () => {
    setShowForgotPassword(false)
    setForgotStep('email')
    setForgotEmail('')
    setForgotCode('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotMessage('')
    setForgotErrors({})
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-9 h-9 text-white" viewBox="0 0 32 32" fill="none">
                <rect x="8" y="6" width="2.5" height="20" rx="1.25" fill="white"/>
                <rect x="8" y="6" width="12" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="14.75" width="9" height="2.5" rx="1.25" fill="white"/>
                <rect x="8" y="23.5" width="12" height="2.5" rx="1.25" fill="white"/>
                <circle cx="24" cy="10" r="2" fill="white" opacity="0.8"/>
                <circle cx="26" cy="22" r="1.5" fill="white" opacity="0.6"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Elmira</h1>
          <p className="text-gray-600 text-lg">Professional Testing Management Platform</p>
        </div>
        
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Administrator Login</h2>
            <p className="text-gray-600">Access testing monitoring dashboard</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ${
                  errors.username ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your username"
                disabled={isLoading}
              />
              {errors.username && (
                <span className="text-red-500 text-sm mt-1 block">{errors.username}</span>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password && (
                <span className="text-red-500 text-sm mt-1 block">{errors.password}</span>
              )}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            </div>
            
            {loginMessage && (
              <div className={`p-4 rounded-lg text-sm ${
                loginMessage.includes('successful') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {loginMessage}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-600 text-sm">Need help? Contact your system administrator</p>
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <button 
                type="button" 
                className="text-blue-600 hover:text-blue-700 font-semibold transition duration-200"
                onClick={onSwitchToRegister}
                disabled={isLoading}
              >
                Create Account
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {forgotStep === 'email' && 'Forgot password'}
                {forgotStep === 'code' && 'Enter reset code'}
                {forgotStep === 'done' && 'Password reset'}
              </h2>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {forgotStep === 'email' && (
              <form onSubmit={handleForgotSendCode} className="space-y-4">
                <p className="text-gray-600 text-sm">Enter the email address on your account. We’ll send you a code to reset your password.</p>
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${forgotErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="your@email.com"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.email && <span className="text-red-500 text-sm mt-1 block">{forgotErrors.email}</span>}
                </div>
                {forgotMessage && (
                  <div className={`p-3 rounded-lg text-sm ${forgotMessage.includes('receive') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {forgotMessage}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={closeForgotPassword} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={forgotLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                    {forgotLoading ? 'Sending...' : 'Send code'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'code' && (
              <form onSubmit={handleForgotResetPassword} className="space-y-4">
                <p className="text-gray-600 text-sm">Check the email at <strong>{forgotEmail}</strong> and enter the 6-digit code below, then set a new password.</p>
                <div>
                  <label htmlFor="forgot-code" className="block text-sm font-medium text-gray-700 mb-2">Reset code</label>
                  <input
                    type="text"
                    id="forgot-code"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${forgotErrors.code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="000000"
                    maxLength={6}
                    disabled={forgotLoading}
                  />
                  {forgotErrors.code && <span className="text-red-500 text-sm mt-1 block">{forgotErrors.code}</span>}
                </div>
                <div>
                  <label htmlFor="forgot-new-password" className="block text-sm font-medium text-gray-700 mb-2">New password</label>
                  <input
                    type="password"
                    id="forgot-new-password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${forgotErrors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="At least 8 characters"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.newPassword && <span className="text-red-500 text-sm mt-1 block">{forgotErrors.newPassword}</span>}
                </div>
                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">Confirm new password</label>
                  <input
                    type="password"
                    id="forgot-confirm-password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${forgotErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Confirm new password"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.confirmPassword && <span className="text-red-500 text-sm mt-1 block">{forgotErrors.confirmPassword}</span>}
                </div>
                {forgotMessage && (
                  <div className={`p-3 rounded-lg text-sm ${forgotMessage.includes('receive') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {forgotMessage}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setForgotStep('email')} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                    Back
                  </button>
                  <button type="submit" disabled={forgotLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
                    {forgotLoading ? 'Resetting...' : 'Reset password'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-4">
                <p className="text-gray-600">{forgotMessage}</p>
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginPage 
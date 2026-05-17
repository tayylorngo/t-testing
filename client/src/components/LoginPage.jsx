import { useState } from 'react'
import { authAPI } from '../services/api'

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
    <div className="el-app-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm el-fade-up">
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

        {/* Login Card */}
        <div className="el-card p-6 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
            <p className="mt-0.5 text-sm text-slate-500">Access your testing dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="el-label">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className={`el-input ${errors.username ? 'el-input-error' : ''}`}
                placeholder="Enter your username"
                disabled={isLoading}
              />
              {errors.username && <span className="el-error">{errors.username}</span>}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="el-label mb-0">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`el-input ${errors.password ? 'el-input-error' : ''}`}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              {errors.password && <span className="el-error">{errors.password}</span>}
            </div>

            {loginMessage && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${
                loginMessage.includes('successful')
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}>
                {loginMessage}
              </div>
            )}

            <button
              type="submit"
              className="el-btn el-btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{' '}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:text-brand-700"
                onClick={onSwitchToRegister}
                disabled={isLoading}
              >
                Create one
              </button>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Need help? Contact your system administrator.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="el-overlay">
          <div className="el-modal el-fade-up p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {forgotStep === 'email' && 'Forgot password'}
                {forgotStep === 'code' && 'Enter reset code'}
                {forgotStep === 'done' && 'Password reset'}
              </h2>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="el-icon-btn"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {forgotStep === 'email' && (
              <form onSubmit={handleForgotSendCode} className="space-y-4">
                <p className="text-sm text-slate-500">Enter the email address on your account. We’ll send you a code to reset your password.</p>
                <div>
                  <label htmlFor="forgot-email" className="el-label">Email</label>
                  <input
                    type="email"
                    id="forgot-email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={`el-input ${forgotErrors.email ? 'el-input-error' : ''}`}
                    placeholder="your@email.com"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.email && <span className="el-error">{forgotErrors.email}</span>}
                </div>
                {forgotMessage && (
                  <div className={`rounded-lg px-3 py-2 text-sm ${forgotMessage.includes('receive') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {forgotMessage}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeForgotPassword} className="el-btn el-btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={forgotLoading} className="el-btn el-btn-primary flex-1">
                    {forgotLoading ? 'Sending…' : 'Send code'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'code' && (
              <form onSubmit={handleForgotResetPassword} className="space-y-4">
                <p className="text-sm text-slate-500">Check the email at <strong className="text-slate-700">{forgotEmail}</strong> and enter the 6-digit code below, then set a new password.</p>
                <div>
                  <label htmlFor="forgot-code" className="el-label">Reset code</label>
                  <input
                    type="text"
                    id="forgot-code"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`el-input text-center text-lg tracking-[0.5em] ${forgotErrors.code ? 'el-input-error' : ''}`}
                    placeholder="000000"
                    maxLength={6}
                    disabled={forgotLoading}
                  />
                  {forgotErrors.code && <span className="el-error">{forgotErrors.code}</span>}
                </div>
                <div>
                  <label htmlFor="forgot-new-password" className="el-label">New password</label>
                  <input
                    type="password"
                    id="forgot-new-password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className={`el-input ${forgotErrors.newPassword ? 'el-input-error' : ''}`}
                    placeholder="At least 8 characters"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.newPassword && <span className="el-error">{forgotErrors.newPassword}</span>}
                </div>
                <div>
                  <label htmlFor="forgot-confirm-password" className="el-label">Confirm new password</label>
                  <input
                    type="password"
                    id="forgot-confirm-password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className={`el-input ${forgotErrors.confirmPassword ? 'el-input-error' : ''}`}
                    placeholder="Confirm new password"
                    disabled={forgotLoading}
                  />
                  {forgotErrors.confirmPassword && <span className="el-error">{forgotErrors.confirmPassword}</span>}
                </div>
                {forgotMessage && (
                  <div className={`rounded-lg px-3 py-2 text-sm ${forgotMessage.includes('receive') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {forgotMessage}
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setForgotStep('email')} className="el-btn el-btn-secondary flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={forgotLoading} className="el-btn el-btn-primary flex-1">
                    {forgotLoading ? 'Resetting…' : 'Reset password'}
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-3 py-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-800">{forgotMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="el-btn el-btn-primary w-full"
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
import { useState, useCallback } from 'react'

export const useCustomAlert = () => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'error'
  })

  const showAlert = useCallback((title, message, type = 'error') => {
    setAlertState({
      isOpen: true,
      title,
      message,
      type
    })
  }, [])

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({
      ...prev,
      isOpen: false
    }))
  }, [])

  const showError = useCallback((message, title = 'Error') => {
    showAlert(title, message, 'error')
  }, [showAlert])

  const showSuccess = useCallback((message, title = 'Success') => {
    showAlert(title, message, 'success')
  }, [showAlert])

  const showWarning = useCallback((message, title = 'Warning') => {
    showAlert(title, message, 'warning')
  }, [showAlert])

  return {
    alertState,
    showAlert,
    hideAlert,
    showError,
    showSuccess,
    showWarning
  }
}

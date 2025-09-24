import React from 'react'

const CustomAlert = ({ isOpen, onClose, title, message, type = 'error' }) => {
  if (!isOpen) return null

  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-700',
          iconColor: 'text-green-600 dark:text-green-400',
          buttonColor: 'bg-green-600 hover:bg-green-700',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
      case 'warning':
        return {
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-700',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
        }
      default: // error
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-700',
          iconColor: 'text-red-600 dark:text-red-400',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
    }
  }

  const styles = getAlertStyles()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
      <div className={`${styles.bgColor} ${styles.borderColor} border rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4`}>
        <div className="flex items-start">
          <div className={`${styles.iconColor} flex-shrink-0 mr-4`}>
            {styles.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className={`${styles.buttonColor} text-white px-6 py-2 rounded-lg font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 focus:ring-gray-500`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomAlert

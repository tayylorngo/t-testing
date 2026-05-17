import React from 'react'

const CustomAlert = ({ isOpen, onClose, title, message, type = 'error' }) => {
  if (!isOpen) return null

  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return {
          iconCircle: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
          buttonClass: 'el-btn el-btn-success',
          icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
      case 'warning':
        return {
          iconCircle: 'bg-amber-100',
          iconColor: 'text-amber-600',
          buttonClass: 'el-btn el-btn-primary',
          icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )
        }
      default: // error
        return {
          iconCircle: 'bg-rose-100',
          iconColor: 'text-rose-600',
          buttonClass: 'el-btn el-btn-danger',
          icon: (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
    }
  }

  const styles = getAlertStyles()

  return (
    <div className="el-overlay z-[100]">
      <div className="el-modal el-fade-up p-6 text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${styles.iconCircle}`}>
          <div className={styles.iconColor}>
            {styles.icon}
          </div>
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          {message}
        </p>
        <button
          onClick={onClose}
          className={`${styles.buttonClass} w-full`}
        >
          OK
        </button>
      </div>
    </div>
  )
}

export default CustomAlert

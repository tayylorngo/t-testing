import React from 'react';

const ImportResultModal = ({ isOpen, onClose, isSuccess, message, details }) => {
  if (!isOpen) return null;

  return (
    <div className="el-overlay">
      <div className="el-modal el-fade-up p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          {isSuccess ? (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        <div className="text-center mb-6">
          <h3 className={`text-lg font-semibold mb-2 ${isSuccess ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isSuccess ? 'Import Successful!' : 'Import Failed'}
          </h3>
          <p className="text-sm text-slate-500 mb-4">{message}</p>

          {details && (
            <div className="text-sm text-slate-500 bg-slate-50 rounded-lg border border-slate-200 p-3">
              {details}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className={`el-btn ${isSuccess ? 'el-btn-success' : 'el-btn-danger'}`}
          >
            {isSuccess ? 'Continue' : 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResultModal;

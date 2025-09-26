import React from 'react';

const ImportResultModal = ({ isOpen, onClose, isSuccess, message, details }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200">
        <div className="flex items-center justify-center mb-4">
          {isSuccess ? (
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
        
        <div className="text-center mb-6">
          <h3 className={`text-lg font-semibold mb-2 ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
            {isSuccess ? 'Import Successful!' : 'Import Failed'}
          </h3>
          <p className="text-gray-600 mb-4">{message}</p>
          
          {details && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded p-3">
              {details}
            </div>
          )}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              isSuccess 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isSuccess ? 'Continue' : 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResultModal;

import React, { useState, useRef } from 'react';
import { parseExcelFile, validateImportData } from '../utils/excelImport';

function ExcelImportModal({ isOpen, onClose, onImport }) {
  const [isLoading, setIsLoading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setIsLoading(true);
    setError('');
    setImportData(null);
    setValidationResult(null);

    try {
      console.log('Starting Excel file parsing...');
      // Parse the Excel file
      const parsedData = await parseExcelFile(file);
      console.log('Parsed data:', parsedData);
      
      // Validate the data
      const validation = validateImportData(parsedData);
      console.log('Validation result:', validation);
      
      setImportData(parsedData);
      setValidationResult(validation);
      
      if (!validation.isValid) {
        setError(`The Excel file contains errors: ${validation.errors.join(', ')}`);
      } else {
        setError(''); // Clear any previous errors
      }
    } catch (err) {
      console.error('Excel parsing error:', err);
      setError(err.message || 'Error parsing Excel file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData || !validationResult?.isValid) return;

    try {
      setIsLoading(true);
      await onImport(importData);
      handleClose();
    } catch (err) {
      setError(err.message || 'Error importing data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setImportData(null);
    setValidationResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Import Excel Data</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {!importData ? (
            <div className="space-y-6">
              {/* Warning about clearing existing data */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Warning: This will clear all existing data
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Importing an Excel file will remove all current rooms and sections from this session and replace them with the data from your Excel file.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Excel File</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="excel-file-input"
                  />
                  <label
                    htmlFor="excel-file-input"
                    className="cursor-pointer flex flex-col items-center space-y-4"
                  >
                    <div className="bg-blue-100 rounded-full p-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">Click to select Excel file</p>
                      <p className="text-sm text-gray-500">Supports .xlsx and .xls formats</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Expected Excel Format</h4>
                <p className="text-blue-800 text-sm mb-2">
                  Your Excel file should contain these required columns:
                </p>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• <strong>Room</strong> - Room name or number</li>
                  <li>• <strong>Section</strong> - Section number</li>
                  <li>• <strong>Student Count</strong> - Number of students in the section</li>
                </ul>
                <p className="text-blue-700 text-xs mt-2">
                  Each row represents one section. Multiple sections can belong to the same room.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Import Preview</h3>
                
                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Rooms:</span>
                      <span className="ml-2 font-medium">{importData.summary.totalRooms}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sections:</span>
                      <span className="ml-2 font-medium">{importData.summary.totalSections}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Students:</span>
                      <span className="ml-2 font-medium">{importData.summary.totalStudents}</span>
                    </div>
                  </div>
                </div>

                {/* Validation Results */}
                {validationResult && (
                  <div className="mb-4">
                    {validationResult.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                        <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
                        <ul className="text-red-800 text-sm space-y-1">
                          {validationResult.errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                        <h4 className="font-medium text-yellow-900 mb-2">Warnings:</h4>
                        <ul className="text-yellow-800 text-sm space-y-1">
                          {validationResult.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Room Preview */}
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sections</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {importData.rooms.slice(0, 10).map((room, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{room.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {room.sections.map(s => s.number).join(', ')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {room.sections.reduce((sum, s) => sum + (s.studentCount || 0), 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importData.rooms.length > 10 && (
                    <div className="px-4 py-2 text-sm text-gray-500 text-center bg-gray-50">
                      ... and {importData.rooms.length - 10} more rooms
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition duration-200"
              disabled={isLoading}
            >
              Cancel
            </button>
            
            {importData && validationResult?.isValid && (
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span>Import Data</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExcelImportModal;

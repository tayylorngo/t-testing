import React, { useState, useRef, useEffect } from 'react';
import { parseExcelFile, validateImportData } from '../utils/excelImport';

// Flatten rooms+sections to one row per section for editing
function flattenToRows(importData) {
  if (!importData?.rooms) return [];
  return importData.rooms.flatMap((room) =>
    (room.sections || []).map((s) => ({
      room: room.name,
      section: s.number,
      studentCount: s.studentCount ?? 0,
      accommodations: Array.isArray(s.accommodations) ? [...s.accommodations] : []
    }))
  );
}

// Parse accommodations string (comma or / separated) into array
function parseAccommodationsInput(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(/[,\/]/).map((s) => s.trim()).filter(Boolean);
}

// Build import payload from editable rows (group by room)
function buildImportDataFromRows(rows) {
  const toAcc = (r) => Array.isArray(r.accommodations) ? r.accommodations : parseAccommodationsInput(String(r.accommodationsText || ''));
  const sections = rows.map((r) => ({
    number: r.section,
    studentCount: Number(r.studentCount) || 1,
    accommodations: toAcc(r)
  }));
  const roomOrder = [];
  const roomSections = new Map();
  rows.forEach((r) => {
    const name = String(r.room).trim();
    if (!name) return;
    if (!roomSections.has(name)) {
      roomOrder.push(name);
      roomSections.set(name, []);
    }
    roomSections.get(name).push({
      number: r.section,
      studentCount: Number(r.studentCount) || 1,
      accommodations: toAcc(r)
    });
  });
  const rooms = roomOrder.map((name) => ({
    name,
    sections: roomSections.get(name) || [],
    supplies: []
  }));
  const totalStudents = sections.reduce((sum, s) => sum + (s.studentCount || 0), 0);
  return { rooms, sections, summary: { totalRooms: rooms.length, totalSections: sections.length, totalStudents } };
}

function ExcelImportModal({ isOpen, onClose, onImport, isImporting = false, importProgress = {} }) {
  const [isLoading, setIsLoading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [editableRows, setEditableRows] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (importData?.rooms) {
      setEditableRows(flattenToRows(importData));
    } else {
      setEditableRows([]);
    }
  }, [importData]);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setIsLoading(true);
    setError('');
    setImportData(null);
    setValidationResult(null);
    setEditableRows([]);

    try {
      const parsedData = await parseExcelFile(file);
      const validation = validateImportData(parsedData);
      setImportData(parsedData);
      setValidationResult(validation);
      if (!validation.isValid) {
        setError(`The Excel file contains errors: ${validation.errors.join(', ')}`);
      } else {
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Error parsing Excel file');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRow = (index, field, value) => {
    setEditableRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'section') return { ...row, section: parseInt(value, 10) || value };
        if (field === 'studentCount') return { ...row, studentCount: Math.max(0, parseInt(value, 10) || 0) };
        return { ...row, [field]: value };
      })
    );
  };

  const removeRow = (index) => {
    setEditableRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const built = buildImportDataFromRows(editableRows);
    if (!built.rooms.length || !built.sections.length) {
      setError('Add at least one room and one section.');
      return;
    }
    setError('');
    try {
      setIsLoading(true);
      setError('');
      await onImport(built);
      handleClose();
    } catch (err) {
      setError(err.message || 'Error importing data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    setImportData(null);
    setEditableRows([]);
    setValidationResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!isOpen) return null;

  const progressPct = importProgress?.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">
        <div className="p-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Import Excel Data</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ×
            </button>
          </div>

          {isImporting ? (
            <div className="py-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Importing…</h3>
              <p className="text-sm text-gray-600 text-center mb-4">{importProgress?.message || 'Please wait...'}</p>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 text-center mt-2">{progressPct}%</p>
            </div>
          ) : !importData ? (
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
                <p className="text-blue-800 text-sm mt-2 mb-1">
                  Optional column:
                </p>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• <strong>Accommodations</strong> - List accommodations for the section. Separate multiple items with <strong>/</strong> or <strong>w/</strong> (e.g. <code className="bg-blue-100 px-1 rounded">1.5x w/ reader</code> or <code className="bg-blue-100 px-1 rounded">2x/reader/comp</code>). &quot;ISS/ELL&quot; is kept as one accommodation.</li>
                </ul>
                <p className="text-blue-700 text-xs mt-2">
                  Each row represents one section. Multiple sections can belong to the same room.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Preview — edit as needed</h3>

              {validationResult?.errors?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h4 className="font-medium text-red-900 mb-1 text-sm">Errors:</h4>
                  <ul className="text-red-800 text-sm space-y-0.5">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult?.warnings?.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <h4 className="font-medium text-yellow-900 mb-1 text-sm">Warnings:</h4>
                  <ul className="text-yellow-800 text-sm space-y-0.5">
                    {validationResult.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary from current editable rows */}
              {(() => {
                const built = editableRows.length ? buildImportDataFromRows(editableRows) : null;
                if (!built) return null;
                return (
                  <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
                    <span><strong>Rooms:</strong> {built.summary.totalRooms}</span>
                    <span><strong>Sections:</strong> {built.summary.totalSections}</span>
                    <span><strong>Total students:</strong> {built.summary.totalStudents}</span>
                  </div>
                );
              })()}

              {/* Full editable table — one row per section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0 overflow-y-auto max-h-[50vh]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Room</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase w-24">Section</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase w-28">Count</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Accommodations</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editableRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={row.room}
                            onChange={(e) => updateRow(index, 'room', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            min={1}
                            value={row.section}
                            onChange={(e) => updateRow(index, 'section', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            min={0}
                            value={row.studentCount}
                            onChange={(e) => updateRow(index, 'studentCount', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={Array.isArray(row.accommodations) ? row.accommodations.join(', ') : ''}
                            onChange={(e) => updateRow(index, 'accommodations', parseAccommodationsInput(e.target.value))}
                            placeholder="e.g. 1.5x, reader"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                            title="Remove row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isImporting}
            >
              Cancel
            </button>
            {editableRows.length > 0 && !isImporting && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>Import Data</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExcelImportModal;

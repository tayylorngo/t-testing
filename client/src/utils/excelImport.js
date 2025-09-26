import * as XLSX from 'xlsx';

/**
 * Parse Excel file and extract room/section data
 * @param {File} file - The Excel file to parse
 * @returns {Promise<Object>} - Parsed data with rooms and sections
 */
export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Look for the main data sheet (could be 'Rooms & Sections', 'Sheet1', or first sheet)
        let worksheetName = null;
        const sheetNames = workbook.SheetNames;
        
        // Try to find the main data sheet
        if (sheetNames.includes('Rooms & Sections')) {
          worksheetName = 'Rooms & Sections';
        } else if (sheetNames.includes('Sheet1')) {
          worksheetName = 'Sheet1';
        } else if (sheetNames.length > 0) {
          worksheetName = sheetNames[0];
        }
        
        if (!worksheetName) {
          reject(new Error('No valid worksheet found in the Excel file'));
          return;
        }
        
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Parse the data
        const parsedData = parseExcelData(jsonData);
        resolve(parsedData);
        
      } catch (error) {
        reject(new Error(`Error parsing Excel file: ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse the Excel data array into structured room/section data
 * @param {Array} jsonData - Raw data from Excel sheet
 * @returns {Object} - Structured data with rooms, sections, and attendance
 */
const parseExcelData = (jsonData) => {
  if (!jsonData || jsonData.length === 0) {
    throw new Error('Excel file appears to be empty');
  }
  
  // Find the header row (look for common column headers)
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (row && row.length > 0) {
      // Look for common headers
      const headerText = row[0]?.toString().toLowerCase() || '';
      if (headerText.includes('room') || headerText.includes('section') || 
          headerText.includes('student') || headerText.includes('attendance')) {
        headerRowIndex = i;
        headers = row.map(h => h?.toString().toLowerCase().trim() || '');
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Could not find header row in Excel file. Please ensure the first column contains room or section information.');
  }
  
  // Map column indices
  const columnMap = mapColumns(headers);
  
  // Parse data rows
  const rooms = new Map();
  const sections = [];
  const attendanceData = [];
  
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    const rowData = parseDataRow(row, columnMap);
    if (!rowData) continue;
    
    // Group by room
    if (rowData.room) {
      if (!rooms.has(rowData.room)) {
        rooms.set(rowData.room, {
          name: rowData.room,
          sections: [],
          supplies: [],
          attendance: {
            present: 0,
            absent: 0,
            total: 0
          }
        });
      }
      
      const room = rooms.get(rowData.room);
      
      // Add section if present
      if (rowData.section) {
        const section = {
          number: rowData.section,
          studentCount: rowData.studentCount || 0,
          accommodations: rowData.accommodations || [],
          notes: rowData.notes || ''
        };
        
        room.sections.push(section);
        sections.push(section);
      }
      
      // Add attendance data if present
      if (rowData.present !== undefined) {
        room.attendance.present += rowData.present;
      }
      if (rowData.absent !== undefined) {
        room.attendance.absent += rowData.absent;
      }
      if (rowData.total !== undefined) {
        room.attendance.total += rowData.total;
      }
      
      // Store individual attendance record
      if (rowData.present !== undefined || rowData.absent !== undefined) {
        attendanceData.push({
          room: rowData.room,
          section: rowData.section,
          present: rowData.present || 0,
          absent: rowData.absent || 0,
          total: rowData.total || 0
        });
      }
    }
  }
  
  return {
    rooms: Array.from(rooms.values()),
    sections: sections,
    attendance: attendanceData,
    summary: {
      totalRooms: rooms.size,
      totalSections: sections.length,
      totalStudents: sections.reduce((sum, section) => sum + (section.studentCount || 0), 0)
    }
  };
};

/**
 * Map column headers to data fields
 * @param {Array} headers - Column headers from Excel
 * @returns {Object} - Column mapping
 */
const mapColumns = (headers) => {
  const mapping = {
    room: -1,
    section: -1,
    studentCount: -1,
    accommodations: -1,
    notes: -1,
    present: -1,
    absent: -1,
    total: -1
  };
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    
    if (h.includes('room')) {
      mapping.room = index;
    } else if (h.includes('section')) {
      mapping.section = index;
    } else if (h.includes('student') && h.includes('count')) {
      mapping.studentCount = index;
    } else if (h.includes('accommodation')) {
      mapping.accommodations = index;
    } else if (h.includes('note')) {
      mapping.notes = index;
    } else if (h.includes('present')) {
      mapping.present = index;
    } else if (h.includes('absent')) {
      mapping.absent = index;
    } else if (h.includes('total')) {
      mapping.total = index;
    }
  });
  
  return mapping;
};

/**
 * Parse a single data row
 * @param {Array} row - Excel row data
 * @param {Object} columnMap - Column mapping
 * @returns {Object|null} - Parsed row data or null if invalid
 */
const parseDataRow = (row, columnMap) => {
  const data = {};
  
  // Extract room name
  if (columnMap.room >= 0 && row[columnMap.room]) {
    data.room = row[columnMap.room].toString().trim();
  }
  
  // Extract section number
  if (columnMap.section >= 0 && row[columnMap.section]) {
    const sectionValue = row[columnMap.section];
    if (typeof sectionValue === 'number') {
      data.section = sectionValue;
    } else {
      const sectionStr = sectionValue.toString().trim();
      const sectionNum = parseInt(sectionStr);
      if (!isNaN(sectionNum)) {
        data.section = sectionNum;
      }
    }
  }
  
  // Extract student count
  if (columnMap.studentCount >= 0 && row[columnMap.studentCount]) {
    const studentValue = row[columnMap.studentCount];
    if (typeof studentValue === 'number') {
      data.studentCount = studentValue;
    } else {
      const studentStr = studentValue.toString().trim();
      const studentNum = parseInt(studentStr);
      if (!isNaN(studentNum) && studentNum > 0) {
        data.studentCount = studentNum;
      }
    }
  }
  
  // Extract accommodations
  if (columnMap.accommodations >= 0 && row[columnMap.accommodations]) {
    const accommodationsStr = row[columnMap.accommodations].toString().trim();
    if (accommodationsStr) {
      // Split by common delimiters and clean up
      data.accommodations = accommodationsStr
        .split(/[,;|]/)
        .map(acc => acc.trim())
        .filter(acc => acc.length > 0);
    }
  }
  
  // Extract notes
  if (columnMap.notes >= 0 && row[columnMap.notes]) {
    data.notes = row[columnMap.notes].toString().trim();
  }
  
  // Extract attendance numbers
  if (columnMap.present >= 0 && row[columnMap.present]) {
    const presentValue = row[columnMap.present];
    if (typeof presentValue === 'number') {
      data.present = presentValue;
    } else {
      const presentStr = presentValue.toString().trim();
      const presentNum = parseInt(presentStr);
      if (!isNaN(presentNum) && presentNum >= 0) {
        data.present = presentNum;
      }
    }
  }
  
  if (columnMap.absent >= 0 && row[columnMap.absent]) {
    const absentValue = row[columnMap.absent];
    if (typeof absentValue === 'number') {
      data.absent = absentValue;
    } else {
      const absentStr = absentValue.toString().trim();
      const absentNum = parseInt(absentStr);
      if (!isNaN(absentNum) && absentNum >= 0) {
        data.absent = absentNum;
      }
    }
  }
  
  if (columnMap.total >= 0 && row[columnMap.total]) {
    const totalValue = row[columnMap.total];
    if (typeof totalValue === 'number') {
      data.total = totalValue;
    } else {
      const totalStr = totalValue.toString().trim();
      const totalNum = parseInt(totalStr);
      if (!isNaN(totalNum) && totalNum >= 0) {
        data.total = totalNum;
      }
    }
  }
  
  // Must have at least a room name to be valid
  return data.room ? data : null;
};

/**
 * Validate parsed data before importing
 * @param {Object} parsedData - Parsed Excel data
 * @returns {Object} - Validation result
 */
export const validateImportData = (parsedData) => {
  const errors = [];
  const warnings = [];
  
  if (!parsedData.rooms || parsedData.rooms.length === 0) {
    errors.push('No rooms found in the Excel file');
  }
  
  if (!parsedData.sections || parsedData.sections.length === 0) {
    errors.push('No sections found in the Excel file');
  }
  
  // Check for duplicate room names
  const roomNames = parsedData.rooms.map(room => room.name);
  const duplicateRooms = roomNames.filter((name, index) => roomNames.indexOf(name) !== index);
  if (duplicateRooms.length > 0) {
    errors.push(`Duplicate room names found: ${duplicateRooms.join(', ')}`);
  }
  
  // Check for duplicate section numbers
  const sectionNumbers = parsedData.sections.map(section => section.number);
  const duplicateSections = sectionNumbers.filter((num, index) => sectionNumbers.indexOf(num) !== index);
  if (duplicateSections.length > 0) {
    errors.push(`Duplicate section numbers found: ${duplicateSections.join(', ')}`);
  }
  
  // Check for invalid student counts
  const invalidSections = parsedData.sections.filter(section => 
    !section.studentCount || section.studentCount < 1
  );
  if (invalidSections.length > 0) {
    warnings.push(`${invalidSections.length} sections have invalid or missing student counts`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: parsedData.summary
  };
};

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
  console.log('Parsing Excel data:', jsonData);
  
  if (!jsonData || jsonData.length === 0) {
    throw new Error('Excel file appears to be empty');
  }
  
  // Find the header row (look for common column headers)
  let headerRowIndex = -1;
  let headers = [];
  
  console.log('Looking for header row...');
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) { // Only check first 10 rows
    const row = jsonData[i];
    console.log(`Row ${i}:`, row);
    if (row && row.length > 0) {
      // Look for common headers
      const headerText = row[0]?.toString().toLowerCase() || '';
      console.log(`Row ${i} header text: "${headerText}"`);
      if (headerText.includes('room') || headerText.includes('section') || 
          headerText.includes('student') || headerText.includes('attendance')) {
        headerRowIndex = i;
        headers = row.map(h => h?.toString().toLowerCase().trim() || '');
        console.log('Found header row at index:', headerRowIndex);
        console.log('Headers:', headers);
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    console.log('No header row found. Available data:');
    jsonData.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}:`, row);
    });
    throw new Error('Could not find header row in Excel file. Please ensure the first column contains room or section information.');
  }
  
  // Map column indices
  const columnMap = mapColumns(headers);
  console.log('Column mapping:', columnMap);
  
  // Parse data rows
  const rooms = new Map();
  const sections = [];
  
  console.log('Parsing data rows...');
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    console.log(`Processing row ${i}:`, row);
    if (!row || row.length === 0) {
      console.log(`Skipping empty row ${i}`);
      continue;
    }
    
    const rowData = parseDataRow(row, columnMap);
    console.log(`Parsed row data:`, rowData);
    if (!rowData) {
      console.log(`Skipping invalid row ${i}`);
      continue;
    }
    
    // Group by room
    if (rowData.room && rowData.section && rowData.studentCount) {
      console.log(`Adding section ${rowData.section} to room ${rowData.room}`);
      if (!rooms.has(rowData.room)) {
        rooms.set(rowData.room, {
          name: rowData.room,
          sections: [],
          supplies: []
        });
      }
      
      const room = rooms.get(rowData.room);
      
      // Add section
      const section = {
        number: rowData.section,
        studentCount: rowData.studentCount,
        accommodations: [],
        notes: ''
      };
      
      room.sections.push(section);
      sections.push(section);
    } else {
      console.log(`Row ${i} missing required data:`, {
        room: rowData?.room,
        section: rowData?.section,
        studentCount: rowData?.studentCount
      });
    }
  }
  
  console.log('Final rooms:', Array.from(rooms.values()));
  console.log('Final sections:', sections);
  
  return {
    rooms: Array.from(rooms.values()),
    sections: sections,
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
  console.log('Mapping columns from headers:', headers);
  const mapping = {
    room: -1,
    section: -1,
    studentCount: -1
  };
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    console.log(`Header ${index}: "${header}" -> "${h}"`);
    
    if (h.includes('room')) {
      mapping.room = index;
      console.log(`Found room column at index ${index}`);
    } else if (h.includes('section')) {
      mapping.section = index;
      console.log(`Found section column at index ${index}`);
    } else if (h.includes('student') && h.includes('count')) {
      mapping.studentCount = index;
      console.log(`Found student count column at index ${index}`);
    }
  });
  
  console.log('Final column mapping:', mapping);
  return mapping;
};

/**
 * Parse a single data row
 * @param {Array} row - Excel row data
 * @param {Object} columnMap - Column mapping
 * @returns {Object|null} - Parsed row data or null if invalid
 */
const parseDataRow = (row, columnMap) => {
  console.log('Parsing data row:', row, 'with column map:', columnMap);
  const data = {};
  
  // Extract room name
  if (columnMap.room >= 0 && row[columnMap.room]) {
    data.room = row[columnMap.room].toString().trim();
    console.log('Extracted room:', data.room);
  } else {
    console.log('No room found. Column index:', columnMap.room, 'Value:', row[columnMap.room]);
  }
  
  // Extract section number
  if (columnMap.section >= 0 && row[columnMap.section]) {
    const sectionValue = row[columnMap.section];
    console.log('Section value:', sectionValue, 'Type:', typeof sectionValue);
    if (typeof sectionValue === 'number') {
      data.section = sectionValue;
    } else {
      const sectionStr = sectionValue.toString().trim();
      const sectionNum = parseInt(sectionStr);
      console.log('Parsed section number:', sectionNum);
      if (!isNaN(sectionNum)) {
        data.section = sectionNum;
      }
    }
  } else {
    console.log('No section found. Column index:', columnMap.section, 'Value:', row[columnMap.section]);
  }
  
  // Extract student count
  if (columnMap.studentCount >= 0 && row[columnMap.studentCount]) {
    const studentValue = row[columnMap.studentCount];
    console.log('Student value:', studentValue, 'Type:', typeof studentValue);
    if (typeof studentValue === 'number') {
      data.studentCount = studentValue;
    } else {
      const studentStr = studentValue.toString().trim();
      const studentNum = parseInt(studentStr);
      console.log('Parsed student count:', studentNum);
      if (!isNaN(studentNum) && studentNum > 0) {
        data.studentCount = studentNum;
      }
    }
  } else {
    console.log('No student count found. Column index:', columnMap.studentCount, 'Value:', row[columnMap.studentCount]);
  }
  
  console.log('Final parsed data:', data);
  
  // Must have room name, section number, and student count to be valid
  const isValid = data.room && data.section && data.studentCount;
  console.log('Is valid row:', isValid);
  return isValid ? data : null;
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
    errors.push(`${invalidSections.length} sections have invalid or missing student counts`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: parsedData.summary
  };
};

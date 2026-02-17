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
  // Prefer a row that includes "accommodation" so we don't stop at an earlier row that only has Room/Section/Count
  let headerRowIndex = -1;
  let headers = [];
  let fallbackHeaderRowIndex = -1;
  let fallbackHeaders = [];
  
  console.log('Looking for header row...');
  for (let i = 0; i < Math.min(jsonData.length, 10); i++) { // Only check first 10 rows
    const row = jsonData[i];
    console.log(`Row ${i}:`, row);
    if (row && Array.isArray(row) && row.length > 0) {
      const headerTexts = row.map(h => (h != null && h !== '') ? h.toString().toLowerCase().trim() : '');
      console.log(`Row ${i} header texts:`, headerTexts);
      
      const hasRoomKeyword = headerTexts.some(h => h && h.includes('room'));
      const hasSectionKeyword = headerTexts.some(h => h && h.includes('section'));
      const hasStudentKeyword = headerTexts.some(h => h && h.includes('student'));
      const hasAccommodationKeyword = headerTexts.some(h => h && h.includes('accommodation'));
      
      console.log(`Row ${i} keywords found:`, { hasRoomKeyword, hasSectionKeyword, hasStudentKeyword, hasAccommodationKeyword });
      
      if (hasRoomKeyword || hasSectionKeyword || hasStudentKeyword) {
        if (fallbackHeaderRowIndex === -1) {
          fallbackHeaderRowIndex = i;
          fallbackHeaders = headerTexts;
        }
        if (hasAccommodationKeyword) {
          headerRowIndex = i;
          headers = headerTexts;
          console.log('Found header row with accommodations at index:', headerRowIndex);
          break;
        }
      }
    }
  }
  if (headerRowIndex === -1 && fallbackHeaderRowIndex >= 0) {
    headerRowIndex = fallbackHeaderRowIndex;
    headers = fallbackHeaders;
    console.log('Using fallback header row at index:', headerRowIndex);
  }
  console.log('Headers:', headers);
  
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
  let processedRows = 0;
  let validRows = 0;
  
  console.log('Parsing data rows...');
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    processedRows++;
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
    
    // Group by room - multiple rows with same room = multiple sections in that room
    if (rowData.room && rowData.section && rowData.studentCount) {
      validRows++;
      console.log(`Adding section ${rowData.section} to room ${rowData.room}`);
      
      if (!rooms.has(rowData.room)) {
        rooms.set(rowData.room, {
          name: rowData.room,
          sections: [],
          supplies: []
        });
        console.log(`Created new room: ${rowData.room}`);
      }
      
      const room = rooms.get(rowData.room);
      
      // Check if section already exists in this room
      const existingSection = room.sections.find(s => s.number === rowData.section);
      const accommodations = Array.isArray(rowData.accommodations) ? rowData.accommodations : [];
      if (existingSection) {
        console.log(`Section ${rowData.section} already exists in room ${rowData.room}, updating student count and accommodations`);
        existingSection.studentCount = rowData.studentCount;
        existingSection.accommodations = accommodations;
      } else {
        // Add new section
        const section = {
          number: rowData.section,
          studentCount: rowData.studentCount,
          accommodations,
          notes: ''
        };
        
        room.sections.push(section);
        sections.push(section);
        console.log(`Added new section ${rowData.section} with ${rowData.studentCount} students and accommodations [${accommodations.join(', ')}] to room ${rowData.room}`);
      }
    } else {
      console.log(`Row ${i} missing required data:`, {
        room: rowData?.room,
        section: rowData?.section,
        studentCount: rowData?.studentCount
      });
    }
  }
  
  console.log(`Processed ${processedRows} rows, ${validRows} valid rows`);
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

const ISS_ELL_PLACEHOLDER = '{{ISS_ELL}}';

/**
 * Parse accommodations string: split by " w/" and by "/", but keep "ISS/ELL" as one accommodation.
 * e.g. "1.5x w/ reader" -> ["1.5x", "reader"]; "2x/reader/comp" -> ["2x", "reader", "comp"];
 * "ISS/ELL - spanish" stays one item; "ISS/ELL - bengali w/ reader" -> ["ISS/ELL - bengali", "reader"]
 * @param {string} str - Raw accommodations cell value
 * @returns {string[]} - Array of trimmed accommodation strings
 */
const parseAccommodationsString = (str) => {
  if (!str || typeof str !== 'string') return [];
  const trimmed = str.trim();
  if (!trimmed) return [];
  // 1) Normalize " w/" (with optional spaces) to "/" so "1.5x w/ reader" becomes "1.5x/reader"
  let normalized = trimmed.replace(/\s*w\/\s*/gi, '/');
  // 2) Protect "ISS/ELL" so we don't split on that slash (it's one accommodation name)
  normalized = normalized.replace(/\bISS\/ELL\b/gi, ISS_ELL_PLACEHOLDER);
  return normalized
    .split('/')
    .map(s => s.trim().replace(ISS_ELL_PLACEHOLDER, 'ISS/ELL'))
    .filter(Boolean);
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
    studentCount: -1,
    accommodations: -1
  };
  
  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    console.log(`Header ${index}: "${header}" -> "${h}"`);
    
    // More flexible matching for room column
    if (h.includes('room') || h.includes('classroom') || h.includes('location')) {
      mapping.room = index;
      console.log(`Found room column at index ${index}`);
    } 
    // More flexible matching for section column
    else if (h.includes('section') || h.includes('class') || h.includes('period')) {
      mapping.section = index;
      console.log(`Found section column at index ${index}`);
    } 
    // More flexible matching for student count column
    else if ((h.includes('student') && h.includes('count')) || 
             h.includes('students') || 
             h.includes('enrollment') ||
             (h.includes('count') && !h.includes('room'))) {
      mapping.studentCount = index;
      console.log(`Found student count column at index ${index}`);
    }
    // Accommodations column (accommodation, accommodations, or common abbreviations)
    else if (h.includes('accommodation') || h === 'acc' || h === 'accom' || h.startsWith('accom')) {
      mapping.accommodations = index;
      console.log(`Found accommodations column at index ${index}`);
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
  
  // Extract accommodations (optional column): split by "/" and " w/"
  const accommodationsCol = columnMap.accommodations;
  const accommodationsCell = accommodationsCol >= 0 && row[accommodationsCol] != null ? row[accommodationsCol] : null;
  if (accommodationsCol >= 0 && accommodationsCell !== '' && accommodationsCell !== null && accommodationsCell !== undefined) {
    const raw = accommodationsCell.toString().trim();
    if (raw) {
      data.accommodations = parseAccommodationsString(raw);
      console.log('Parsed accommodations:', data.accommodations);
    } else {
      data.accommodations = [];
    }
  } else {
    data.accommodations = [];
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

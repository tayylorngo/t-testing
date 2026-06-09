import ExcelJS from 'exceljs';

/**
 * Export session data to a styled Excel workbook.
 * @param {Object} session - The session data to export
 * @param {string} filename - The base filename for the exported file
 */
export const exportSessionToExcel = async (session, filename = 'testing-session') => {
  if (!session) {
    console.error('No session data provided for export');
    return;
  }

  const exportTimestamp = new Date();
  const exportDate = exportTimestamp.toLocaleDateString();
  const exportTime = exportTimestamp.toLocaleTimeString();

  const attendanceStats = calculateAttendanceStatistics(session);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Elmira';
  workbook.created = exportTimestamp;

  // ── Session Overview ──────────────────────────────────────────────────────
  const subtitleParts = [];
  if (session.date) {
    subtitleParts.push(new Date(session.date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    }));
  }
  if (session.startTime && session.endTime) {
    subtitleParts.push(`${fmtTime(session.startTime)} – ${fmtTime(session.endTime)}`);
  }

  const wsOverview = workbook.addWorksheet('Session Overview', sheetOpts());
  setColumns(wsOverview, [30, 62]);
  addTitle(wsOverview, session.name || 'Testing Session', 2);
  if (subtitleParts.length) addSubtitle(wsOverview, subtitleParts.join('   •   '), 2);
  blank(wsOverview);

  addGroupHeader(wsOverview, 'Session Details', 2);
  kv(wsOverview, 'Session Name', session.name || '—');
  kv(wsOverview, 'Description', session.description || '—');
  kv(wsOverview, 'Date', session.date ? new Date(session.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—');
  kv(wsOverview, 'Start Time', fmtTime(session.startTime) || '—');
  kv(wsOverview, 'End Time', fmtTime(session.endTime) || '—');
  kvStatus(wsOverview, 'Status', session.status);
  kv(wsOverview, 'Created By', session.createdBy ? `${session.createdBy.firstName || ''} ${session.createdBy.lastName || ''}`.trim() : '—');
  kv(wsOverview, 'Created At', session.createdAt ? new Date(session.createdAt).toLocaleString() : '—');
  blank(wsOverview);

  addGroupHeader(wsOverview, 'Export Information', 2);
  kv(wsOverview, 'Export Date', exportDate);
  kv(wsOverview, 'Export Time', exportTime);
  blank(wsOverview);

  addGroupHeader(wsOverview, 'Session Statistics', 2);
  kvNumber(wsOverview, 'Total Rooms', session.rooms?.length || 0);
  kvNumber(wsOverview, 'Total Sections', session.sections?.length || 0);
  kvNumber(wsOverview, 'Total Students', attendanceStats.totalStudents);
  blank(wsOverview);

  addGroupHeader(wsOverview, 'Attendance (at time of export)', 2);
  kvNumber(wsOverview, 'Present Students', attendanceStats.totalPresent, COLORS.greenText);
  kvNumber(wsOverview, 'Absent Students', attendanceStats.totalAbsent, COLORS.slate700);
  kv(wsOverview, 'Attendance Rate', `${attendanceStats.attendanceRate}%`);
  kvNumber(wsOverview, 'Completed Rooms', attendanceStats.completedRooms);
  kvNumber(wsOverview, 'Active Rooms', attendanceStats.activeRooms);
  kvNumber(wsOverview, 'Planned Rooms', attendanceStats.plannedRooms);

  // ── Rooms & Sections ──────────────────────────────────────────────────────
  buildTableSheet(workbook, {
    name: 'Rooms & Sections',
    title: 'Rooms & Sections',
    headers: ['Room Name', 'Status', 'Total', 'Present', 'Absent', 'Attendance', 'Sections', 'Supplies', 'Notes'],
    widths: [22, 14, 9, 10, 10, 13, 36, 30, 30],
    statusCol: 2,
    centerCols: [3, 4, 5, 6],
    rows: (session.rooms || []).map(room => {
      const total = calculateRoomTotalStudents(room);
      const present = room.presentStudents || 0;
      const absent = room.status === 'completed' ? total - present : '—';
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return [
        room.name || '',
        room.status || '',
        total,
        present,
        absent,
        (room.status === 'completed' || room.status === 'active') ? `${rate}%` : 'N/A',
        room.sections?.map(s => `Section ${s.number} (${s.studentCount} students)`).join(', ') || 'None',
        room.supplies?.join(', ') || 'None',
        room.notes || '',
      ];
    }),
    emptyMessage: 'No rooms found',
  });

  // ── Sections ──────────────────────────────────────────────────────────────
  buildTableSheet(workbook, {
    name: 'Sections',
    title: 'Section Details',
    headers: ['Section #', 'Students', 'Accommodations', 'Notes', 'Assigned Rooms'],
    widths: [12, 11, 36, 30, 28],
    centerCols: [1, 2],
    rows: (session.sections || []).map(section => {
      const assignedRooms = session.rooms?.filter(room =>
        room.sections?.some(rs => rs._id === section._id)
      ).map(room => room.name).join(', ') || 'None';
      return [
        section.number || '',
        section.studentCount || 0,
        section.accommodations?.join(', ') || 'None',
        section.notes || '',
        assignedRooms,
      ];
    }),
    emptyMessage: 'No sections found',
  });

  // ── Proctors ──────────────────────────────────────────────────────────────
  const proctorRows = [];
  (session.rooms || []).forEach(room => {
    if (room.proctors && room.proctors.length > 0) {
      room.proctors.forEach(p => {
        proctorRows.push([room.name || '', p.firstName || '', p.lastName || '', p.email || '', fmtTime(p.startTime), fmtTime(p.endTime)]);
      });
    } else {
      proctorRows.push([room.name || '', 'No proctors assigned', '', '', '', '']);
    }
  });
  buildTableSheet(workbook, {
    name: 'Proctors',
    title: 'Proctor Assignments',
    headers: ['Room Name', 'First Name', 'Last Name', 'Email', 'Start', 'End'],
    widths: [22, 18, 18, 30, 12, 12],
    centerCols: [5, 6],
    rows: proctorRows,
    emptyMessage: 'No rooms found',
  });

  // ── Activity Log ──────────────────────────────────────────────────────────
  buildTableSheet(workbook, {
    name: 'Activity Log',
    title: 'Activity Log',
    headers: ['Timestamp', 'Action', 'User', 'Room', 'Details'],
    widths: [22, 32, 20, 20, 40],
    rows: (session.activityLog || []).map(a => [
      a.timestamp ? new Date(a.timestamp).toLocaleString() : '',
      a.action || '',
      a.userName || '',
      a.roomName || '',
      a.details || '',
    ]),
    emptyMessage: 'No activity log entries',
  });

  // ── Attendance Summary ────────────────────────────────────────────────────
  const wsAtt = workbook.addWorksheet('Attendance Summary', sheetOpts());
  setColumns(wsAtt, [24, 14, 12, 11, 11, 14]);
  addTitle(wsAtt, 'Attendance Summary', 6);
  addSubtitle(wsAtt, `As of ${exportDate} ${exportTime}`, 6);
  blank(wsAtt);

  addGroupHeader(wsAtt, 'Overall', 6);
  kvNumber(wsAtt, 'Total Students', attendanceStats.totalStudents);
  kvNumber(wsAtt, 'Present Students', attendanceStats.totalPresent, COLORS.greenText);
  kvNumber(wsAtt, 'Absent Students', attendanceStats.totalAbsent, COLORS.slate700);
  kv(wsAtt, 'Attendance Rate', `${attendanceStats.attendanceRate}%`);
  blank(wsAtt);

  addGroupHeader(wsAtt, 'Room Status Breakdown', 6);
  kvNumber(wsAtt, 'Completed Rooms', attendanceStats.completedRooms);
  kvNumber(wsAtt, 'Active Rooms', attendanceStats.activeRooms);
  kvNumber(wsAtt, 'Planned Rooms', attendanceStats.plannedRooms);
  blank(wsAtt);

  addGroupHeader(wsAtt, 'Room-by-Room Attendance', 6);
  const attHeaderRow = addTableHeader(wsAtt, ['Room Name', 'Status', 'Total', 'Present', 'Absent', 'Attendance']);
  const attRows = (session.rooms || []).map(room => {
    const total = calculateRoomTotalStudents(room);
    const present = room.presentStudents || 0;
    const absent = room.status === 'completed' ? total - present : '—';
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return [room.name || '', room.status || '', total, present, absent,
      (room.status === 'completed' || room.status === 'active') ? `${rate}%` : 'N/A'];
  });
  if (attRows.length === 0) {
    styleBody(wsAtt, wsAtt.addRow(['No rooms found']), 6, 0);
  } else {
    attRows.forEach((r, i) => {
      const row = wsAtt.addRow(r);
      styleBody(wsAtt, row, 6, i, { statusCol: 2, centerCols: [3, 4, 5, 6] });
    });
  }
  wsAtt.autoFilter = { from: { row: attHeaderRow.number, column: 1 }, to: { row: attHeaderRow.number, column: 6 } };

  // ── Download ──────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const finalFilename = `${filename}-${timestamp}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── Palette (ARGB) ──────────────────────────────────────────────────────────
const COLORS = {
  brand: 'FF4F46E5',      // indigo-600
  brandDark: 'FF4338CA',  // indigo-700
  brandDeep: 'FF3730A3',  // indigo-800
  brandLight: 'FFE0E7FF', // indigo-100
  white: 'FFFFFFFF',
  slate900: 'FF0F172A',
  slate700: 'FF334155',
  slate500: 'FF64748B',
  border: 'FFE2E8F0',     // slate-200
  zebra: 'FFF8FAFC',      // slate-50
  greenText: 'FF15803D', greenBg: 'FFDCFCE7',
  blueText: 'FF1D4ED8', blueBg: 'FFDBEAFE',
  amberText: 'FFB45309', amberBg: 'FFFEF3C7',
  slateTx: 'FF475569', slateBg: 'FFF1F5F9',
};

const FONT = 'Calibri';
const thinBorder = { style: 'thin', color: { argb: COLORS.border } };
const allBorders = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

function sheetOpts() {
  return { views: [{ showGridLines: false }] };
}

function setColumns(ws, widths) {
  ws.columns = widths.map(w => ({ width: w }));
}

function blank(ws) {
  ws.addRow([]).height = 6;
}

function addTitle(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { name: FONT, size: 20, bold: true, color: { argb: COLORS.white } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandDark } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  row.height = 36;
}

function addSubtitle(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { name: FONT, size: 12, bold: true, color: { argb: COLORS.white } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  row.height = 22;
}

function addGroupHeader(ws, text, span) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, span);
  const cell = row.getCell(1);
  cell.font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.brandDeep } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  row.height = 24;
}

// Key/value row (label bold, value plain)
function kv(ws, label, value, valueColor = COLORS.slate900) {
  const row = ws.addRow([label, value]);
  row.height = 20;
  const l = row.getCell(1);
  l.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.slate700 } };
  l.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  l.border = allBorders;
  const v = row.getCell(2);
  v.font = { name: FONT, size: 11, color: { argb: valueColor } };
  v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  v.border = allBorders;
}

function kvNumber(ws, label, value, valueColor = COLORS.slate900) {
  const row = ws.addRow([label, value]);
  row.height = 20;
  const l = row.getCell(1);
  l.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.slate700 } };
  l.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  l.border = allBorders;
  const v = row.getCell(2);
  v.font = { name: FONT, size: 13, bold: true, color: { argb: valueColor } };
  v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  v.border = allBorders;
}

function kvStatus(ws, label, status) {
  const row = ws.addRow([label, (status || '').toUpperCase()]);
  row.height = 20;
  const l = row.getCell(1);
  l.font = { name: FONT, size: 11, bold: true, color: { argb: COLORS.slate700 } };
  l.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  l.border = allBorders;
  const v = row.getCell(2);
  const sc = statusStyle(status);
  v.font = { name: FONT, size: 11, bold: true, color: { argb: sc.tx } };
  v.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
  v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  v.border = allBorders;
}

function statusStyle(status) {
  switch ((status || '').toLowerCase()) {
    case 'completed': return { bg: COLORS.greenBg, tx: COLORS.greenText };
    case 'active': return { bg: COLORS.blueBg, tx: COLORS.blueText };
    case 'planned': return { bg: COLORS.amberBg, tx: COLORS.amberText };
    default: return { bg: COLORS.slateBg, tx: COLORS.slateTx };
  }
}

function addTableHeader(ws, headers) {
  const row = ws.addRow(headers);
  row.height = 26;
  for (let c = 1; c <= headers.length; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT, size: 12, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = allBorders;
  }
  return row;
}

// Style a populated body row across `ncols` columns (zebra by index)
function styleBody(ws, row, ncols, index, opts = {}) {
  const { statusCol, centerCols = [] } = opts;
  row.height = 20;
  const zebra = index % 2 === 1;
  for (let c = 1; c <= ncols; c++) {
    const cell = row.getCell(c);
    cell.border = allBorders;
    const center = centerCols.includes(c);
    cell.alignment = { vertical: 'middle', horizontal: center ? 'center' : 'left', indent: center ? 0 : 1, wrapText: true };
    if (statusCol === c) {
      const sc = statusStyle(cell.value);
      cell.value = (cell.value || '').toString().toUpperCase();
      cell.font = { name: FONT, size: 11, bold: true, color: { argb: sc.tx } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sc.bg } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      cell.font = { name: FONT, size: 11, color: { argb: COLORS.slate700 } };
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
    }
  }
}

// Build a standard titled, headed, zebra-striped table sheet.
function buildTableSheet(workbook, { name, title, headers, widths, rows, statusCol, centerCols = [], emptyMessage }) {
  const ws = workbook.addWorksheet(name, sheetOpts());
  setColumns(ws, widths);
  addTitle(ws, title, headers.length);
  blank(ws);
  const headerRow = addTableHeader(ws, headers);

  if (!rows || rows.length === 0) {
    const row = ws.addRow([emptyMessage || 'No data']);
    row.getCell(1).font = { name: FONT, size: 11, italic: true, color: { argb: COLORS.slate500 } };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    row.height = 20;
  } else {
    rows.forEach((r, i) => styleBody(ws, ws.addRow(r), headers.length, i, { statusCol, centerCols }));
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: headers.length } };
  }

  // Freeze everything down to and including the header row.
  ws.views = [{ state: 'frozen', ySplit: headerRow.number, showGridLines: false }];
  return ws;
}

function fmtTime(time) {
  if (!time || typeof time !== 'string' || !time.includes(':')) return time || '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Calculate total students in a room
 */
const calculateRoomTotalStudents = (room) => {
  if (!room.sections) return 0;
  return room.sections.reduce((total, section) => total + (section.studentCount || 0), 0);
};

/**
 * Calculate comprehensive attendance statistics for the session
 */
const calculateAttendanceStatistics = (session) => {
  if (!session || !session.rooms) {
    return {
      totalStudents: 0,
      totalPresent: 0,
      totalAbsent: 0,
      attendanceRate: 0,
      completedRooms: 0,
      activeRooms: 0,
      plannedRooms: 0,
    };
  }

  let totalStudents = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let completedRooms = 0;
  let activeRooms = 0;
  let plannedRooms = 0;

  session.rooms.forEach(room => {
    const roomTotalStudents = calculateRoomTotalStudents(room);
    const roomPresentStudents = room.presentStudents || 0;

    totalStudents += roomTotalStudents;
    totalPresent += roomPresentStudents;

    // Only count absent students for completed rooms
    if (room.status === 'completed') {
      totalAbsent += (roomTotalStudents - roomPresentStudents);
    }

    // Count rooms by status
    switch (room.status) {
      case 'completed':
        completedRooms++;
        break;
      case 'active':
        activeRooms++;
        break;
      case 'planned':
        plannedRooms++;
        break;
      default:
        break;
    }
  });

  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return {
    totalStudents,
    totalPresent,
    totalAbsent,
    attendanceRate,
    completedRooms,
    activeRooms,
    plannedRooms,
  };
};

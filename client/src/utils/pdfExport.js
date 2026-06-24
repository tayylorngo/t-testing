import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { compareSectionNumbers } from './sectionNumber';

// Palette (RGB) — mirrors the styled Excel export / app brand (indigo).
const BRAND = [79, 70, 229];       // indigo-600
const BRAND_DARK = [67, 56, 202];  // indigo-700
const ZEBRA = [248, 250, 252];     // slate-50
const SLATE700 = [51, 65, 85];
const SLATE900 = [15, 23, 42];
const BORDER = [226, 232, 240];    // slate-200
const INVALID_BG = [254, 226, 226]; // red-200
const INVALID_TX = [185, 28, 28];   // red-700
const STATUS = {
  completed: { bg: [220, 252, 231], tx: [21, 128, 61] },
  active: { bg: [219, 234, 254], tx: [29, 78, 216] },
  planned: { bg: [254, 243, 199], tx: [180, 83, 9] },
};
// Chart colors
const C_GREEN = [22, 163, 74];
const C_RED = [220, 38, 38];
const C_AMBER = [217, 119, 6];
const C_SLATE = [100, 116, 139];
const C_TRACK = [226, 232, 240]; // slate-200 track

// Draw a single full-width stacked bar from segments [{value,color}]. Empty → grey track.
function drawStackedBar(doc, x, y, w, height, segments) {
  const total = segments.reduce((s, g) => s + (g.value || 0), 0);
  doc.setFillColor(...C_TRACK);
  doc.roundedRect(x, y, w, height, 3, 3, 'F');
  if (total <= 0) return;
  let cx = x;
  segments.forEach(g => {
    const sw = (g.value / total) * w;
    if (sw <= 0.5) return;
    doc.setFillColor(...g.color);
    doc.rect(cx, y, sw, height, 'F');
    cx += sw;
  });
}

// Draw labeled horizontal bars [{label,value,color}] at (x,y). Returns the y below.
function drawHBars(doc, x, y, w, rows, { labelW = 100, max } = {}) {
  const trackX = x + labelW;
  const valueW = 32;
  const trackW = Math.max(20, w - labelW - valueW);
  const cap = Math.max(max || 0, ...rows.map(r => r.value || 0), 1);
  const rowH = 17, barH = 10;
  let cy = y;
  rows.forEach(r => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...SLATE700);
    doc.text(String(r.label), x, cy + barH - 1);
    doc.setFillColor(...C_TRACK);
    doc.roundedRect(trackX, cy, trackW, barH, 2, 2, 'F');
    const vw = Math.max(0, Math.min(1, (r.value || 0) / cap)) * trackW;
    if (vw >= 1) { doc.setFillColor(...r.color); doc.roundedRect(trackX, cy, vw, barH, 2, 2, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...SLATE900);
    doc.text(String(r.value ?? 0), trackX + trackW + 6, cy + barH - 1);
    cy += rowH;
  });
  return cy;
}

// A small color swatch + label, used for chart legends.
function legendItem(doc, x, y, color, label) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y - 6, 8, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...SLATE700);
  doc.text(label, x + 12, y);
  return x + 12 + doc.getTextWidth(label) + 16;
}

/**
 * Export session data to a styled PDF document (triggers a download).
 * @param {Object} session - The session data to export
 * @param {string} filename - The base filename for the exported file
 * @param {Array} [invalidations] - Live invalidated-tests list (falls back to session.invalidations)
 */
export const exportSessionToPDF = (session, filename = 'testing-session', invalidations) => {
  const result = buildSessionPDF(session, invalidations);
  if (!result) return;
  result.doc.save(pdfFileName(filename, result.exportTs));
};

/**
 * Build the session PDF and return it as a base64 string (for emailing / uploading).
 * @returns {{ base64: string, filename: string } | null}
 */
export const generateSessionPDFBase64 = (session, filename = 'testing-session', invalidations) => {
  const result = buildSessionPDF(session, invalidations);
  if (!result) return null;
  const dataUri = result.doc.output('datauristring');
  const base64 = dataUri.substring(dataUri.indexOf(',') + 1);
  return { base64, filename: pdfFileName(filename, result.exportTs) };
};

// Filename helper, shared by the download and email paths.
function pdfFileName(filename, exportTs) {
  return `${filename}-${exportTs.toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
}

// Builds the styled PDF document. Returns the jsPDF doc plus the export timestamp,
// or null if no session was provided.
function buildSessionPDF(session, invalidations) {
  if (!session) {
    console.error('No session data provided for export');
    return null;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const exportTs = new Date();
  const stats = calcStats(session);

  const subtitle = [
    session.date ? new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null,
    session.startTime && session.endTime ? `${fmtTime(session.startTime)} – ${fmtTime(session.endTime)}` : null,
  ].filter(Boolean).join('   •   ');

  // Running header banner, drawn on every page.
  const drawHeader = () => {
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, 0, pageW, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(session.name || 'Testing Session', margin, 24);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(subtitle, margin, 40);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageW - margin, 24, { align: 'right' });
  };

  const tableBase = (extra) => ({
    margin: { top: 60, bottom: 28, left: margin, right: margin },
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: SLATE700,
      lineColor: BORDER, lineWidth: 0.5, overflow: 'linebreak', valign: 'middle',
    },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'center', valign: 'middle' },
    alternateRowStyles: { fillColor: ZEBRA },
    theme: 'grid',
    didDrawPage: drawHeader,
    ...extra,
  });

  // Paint a status column's cells (completed/active/planned) with a colored pill.
  const statusPainter = (colIndex) => (data) => {
    if (data.section === 'body' && data.column.index === colIndex) {
      const st = STATUS[String(data.cell.raw || '').toLowerCase()];
      if (st) {
        data.cell.styles.fillColor = st.bg;
        data.cell.styles.textColor = st.tx;
        data.cell.styles.fontStyle = 'bold';
      }
      data.cell.styles.halign = 'center';
      if (Array.isArray(data.cell.text)) {
        data.cell.text = data.cell.text.map(t => String(t).toUpperCase());
      }
    }
  };

  let y = 60;
  const heading = (text) => {
    if (y > pageH - 80) { doc.addPage(); y = 60; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_DARK);
    doc.text(text, margin, y);
    y += 4;
  };
  const advance = () => { y = doc.lastAutoTable.finalY + 14; };

  // ── Session Summary ───────────────────────────────────────────────────────
  // Two label/value pairs per row to keep the summary to a few compact lines.
  heading('Session Summary');
  autoTable(doc, tableBase({
    startY: y,
    body: [
      ['Status', (session.status || '—').toUpperCase(), 'Attendance Rate', `${stats.attendanceRate}%`],
      ['Total Rooms', String(session.rooms?.length || 0), 'Rooms (Done/Active/Planned)', `${stats.completedRooms} / ${stats.activeRooms} / ${stats.plannedRooms}`],
      ['Total Sections', String(session.sections?.length || 0), 'Total Students', String(stats.totalStudents)],
      ['Present Students', String(stats.totalPresent), 'Absent Students', String(stats.totalAbsent)],
      ['Notes Sheet', session.notesSheetUrl || '—', 'Exported', exportTs.toLocaleString()],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 150, textColor: SLATE700 },
      1: { textColor: SLATE900, fontStyle: 'bold', cellWidth: 200 },
      2: { fontStyle: 'bold', cellWidth: 150, textColor: SLATE700 },
      3: { textColor: SLATE900, fontStyle: 'bold' },
    },
  }));
  advance();

  // ── Sections & Attendance ─────────────────────────────────────────────────
  // One row per section, sorted by section #, combining the section details with
  // its present/absent attendance. A section is "Recorded" once a present count has
  // been entered (room.sectionReturns); invalidated sections are highlighted red.
  heading('Sections & Attendance');
  const invalidationList = invalidations || session.invalidations || [];
  const sectionEntries = [];
  (session.rooms || []).forEach(room => {
    (room.sections || []).forEach(section => {
      const total = section.studentCount || 0;
      const raw = room.sectionReturns ? room.sectionReturns[section._id] : undefined;
      const recorded = raw !== undefined && raw !== null;
      const present = recorded ? Number(raw) || 0 : null;
      const sectionInvalidations = invalidationList.filter(inv =>
        String(inv.sectionNumber) === String(section.number) && String(inv.roomId) === String(room._id)
      );
      const invalidated = sectionInvalidations.length > 0;
      let notes = section.notes || '';
      if (invalidated) {
        const invNotes = sectionInvalidations.map(inv => inv.notes).filter(Boolean).join('  |  ');
        notes = notes ? `${notes}\nINVALIDATED: ${invNotes}` : `INVALIDATED: ${invNotes}`;
      }
      sectionEntries.push({
        number: section.number,
        invalidated,
        row: [
          section.number || '',
          room.name || '',
          total,
          recorded ? present : '—',
          recorded ? Math.max(0, total - present) : '—',
          recorded ? 'Recorded' : 'Pending',
          section.accommodations?.join(', ') || 'None',
          notes,
        ],
      });
    });
  });
  sectionEntries.sort((a, b) => compareSectionNumbers(a.number, b.number));
  const mergedFlags = sectionEntries.map(e => e.invalidated);
  autoTable(doc, tableBase({
    startY: y,
    head: [['Section #', 'Room', 'Students', 'Present', 'Absent', 'Status', 'Accommodations', 'Notes']],
    body: rowsOrNote(sectionEntries.map(e => e.row), 8, 'No sections found'),
    columnStyles: {
      0: { halign: 'center', cellWidth: 56 },
      1: { cellWidth: 90 },
      2: { halign: 'center', cellWidth: 50 },
      3: { halign: 'center', cellWidth: 50 },
      4: { halign: 'center', cellWidth: 50 },
      5: { halign: 'center', cellWidth: 70 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (mergedFlags[data.row.index]) {
        data.cell.styles.fillColor = INVALID_BG;
        data.cell.styles.textColor = INVALID_TX;
        data.cell.styles.fontStyle = 'bold';
        return;
      }
      if (data.column.index === 5) {
        const v = String(data.cell.raw || '').toLowerCase();
        if (v === 'recorded') { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = 'bold'; }
        else if (v === 'pending') { data.cell.styles.textColor = [180, 83, 9]; data.cell.styles.fontStyle = 'bold'; }
      }
    },
  }));
  advance();

  // ── Rooms & Sections ──────────────────────────────────────────────────────
  heading('Rooms & Sections');
  autoTable(doc, tableBase({
    startY: y,
    head: [['Room', 'Status', 'Total', 'Present', 'Absent', 'Attendance', 'Sections', 'Notes']],
    body: rowsOrNote((session.rooms || []).map(room => {
      const total = roomTotal(room);
      const present = roomPresent(room);
      const absent = room.status === 'completed' ? roomAbsent(room) : '—';
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return [
        room.name || '', room.status || '', total, present, absent,
        (room.status === 'completed' || room.status === 'active') ? `${rate}%` : 'N/A',
        room.sections?.map(s => `Section ${s.number} (${s.studentCount} students)`).join(', ') || 'None',
        room.notes || '',
      ];
    }), 8, 'No rooms found'),
    columnStyles: {
      2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 48 },
      4: { halign: 'center', cellWidth: 44 }, 5: { halign: 'center', cellWidth: 64 },
      6: { cellWidth: 150 }, 7: { cellWidth: 130 },
    },
    didParseCell: statusPainter(1),
  }));
  advance();

  // ── Session Overview (charts) ─────────────────────────────────────────────
  // Presentation-friendly visual summary that replaces the long activity-log table.
  const usableW = pageW - 2 * margin;
  // The overview block needs ~150pt; start a fresh page if it won't fit.
  if (y > pageH - 170) { doc.addPage(); y = 60; }
  heading('Session Overview');
  y += 6;

  // Attendance — stacked bar (present / absent / not-yet-recorded).
  const recordedSoFar = stats.totalPresent + stats.totalAbsent;
  const pending = Math.max(0, stats.totalStudents - recordedSoFar);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...SLATE700);
  doc.text(`Attendance  —  ${stats.attendanceRate}% present`, margin, y);
  y += 8;
  drawStackedBar(doc, margin, y, usableW, 16, [
    { value: stats.totalPresent, color: C_GREEN },
    { value: stats.totalAbsent, color: C_RED },
    { value: pending, color: C_SLATE },
  ]);
  y += 24;
  let lx = margin;
  lx = legendItem(doc, lx, y, C_GREEN, `Present ${stats.totalPresent}`);
  lx = legendItem(doc, lx, y, C_RED, `Absent ${stats.totalAbsent}`);
  legendItem(doc, lx, y, C_SLATE, `Pending ${pending}`);
  y += 18;

  // Sections recorded progress.
  let secTotal = 0, secRecorded = 0;
  (session.rooms || []).forEach(room => (room.sections || []).forEach(s => {
    secTotal += 1;
    if (room.sectionReturns && Object.prototype.hasOwnProperty.call(room.sectionReturns, s._id)) secRecorded += 1;
  }));

  // Two side-by-side bar groups: Rooms by status, and Sections recorded.
  const colW = (usableW - 24) / 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...SLATE700);
  doc.text('Rooms by status', margin, y);
  doc.text('Sections recorded', margin + colW + 24, y);
  const barsY = y + 10;
  drawHBars(doc, margin, barsY, colW, [
    { label: 'Completed', value: stats.completedRooms, color: C_GREEN },
    { label: 'Active', value: stats.activeRooms, color: C_AMBER },
    { label: 'Planned', value: stats.plannedRooms, color: C_SLATE },
  ], { labelW: 70, max: session.rooms?.length || 0 });
  drawHBars(doc, margin + colW + 24, barsY, colW, [
    { label: 'Recorded', value: secRecorded, color: BRAND, max: secTotal },
    { label: 'Pending', value: Math.max(0, secTotal - secRecorded), color: C_AMBER, max: secTotal },
  ], { labelW: 70, max: secTotal });
  y = barsY + 3 * 17 + 8;

  // ── Recent Activity (condensed) ───────────────────────────────────────────
  // Only the most recent entries, so the report stays presentation-length.
  const RECENT = 12;
  const allLog = session.activityLog || [];
  const recent = allLog.slice(-RECENT).reverse();
  const omitted = Math.max(0, allLog.length - recent.length);
  heading(`Recent Activity${omitted > 0 ? `  (latest ${recent.length} of ${allLog.length})` : ''}`);
  autoTable(doc, tableBase({
    startY: y,
    head: [['Timestamp', 'Action', 'User', 'Room']],
    body: rowsOrNote(recent.map(a => [
      a.timestamp ? new Date(a.timestamp).toLocaleString() : '',
      a.action || '', a.userName || '', a.roomName || '',
    ]), 4, 'No activity log entries'),
    columnStyles: { 0: { cellWidth: 120 }, 2: { cellWidth: 110 }, 3: { cellWidth: 100 } },
  }));

  return { doc, exportTs };
}

/**
 * Build the auto-generated subject + body text for emailing a session report.
 * @returns {{ subject: string, body: string }}
 */
export function buildReportEmail(session) {
  if (!session) return { subject: 'Testing Session Report', body: '' };
  const stats = calcStats(session);
  const name = session.name || 'Testing Session';
  const dateStr = session.date
    ? new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : 'N/A';
  const timeStr = session.startTime && session.endTime
    ? `${fmtTime(session.startTime)} – ${fmtTime(session.endTime)}`
    : 'N/A';

  const subject = `Testing Session Report — ${name}${session.date ? ` (${new Date(session.date).toLocaleDateString('en-US', { timeZone: 'UTC' })})` : ''}`;

  const body = [
    `Attached is the testing session report for "${name}".`,
    '',
    `Date: ${dateStr}`,
    `Time: ${timeStr}`,
    `Status: ${(session.status || 'N/A').toUpperCase()}`,
    '',
    `Rooms: ${session.rooms?.length || 0} (${stats.completedRooms} completed / ${stats.activeRooms} active / ${stats.plannedRooms} planned)`,
    `Sections: ${session.sections?.length || 0}`,
    `Students Present: ${stats.totalPresent} of ${stats.totalStudents} (${stats.attendanceRate}% attendance)`,
    `Students Absent: ${stats.totalAbsent}`,
    '',
    'This report was generated automatically. The full details are in the attached PDF.',
  ].join('\n');

  return { subject, body };
}

// Return body rows, or a single note row padded to `ncols` when empty.
function rowsOrNote(rows, ncols, note) {
  if (rows && rows.length) return rows;
  return [[note, ...Array(Math.max(0, ncols - 1)).fill('')]];
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

function roomTotal(room) {
  if (!room.sections) return 0;
  return room.sections.reduce((total, section) => total + (section.studentCount || 0), 0);
}

// Present/absent are tallied from the per-section present counts (room.sectionReturns),
// not the room-level presentStudents field, which goes stale when students move rooms.
function roomPresent(room) {
  if (!room.sections || !room.sectionReturns) return 0;
  return room.sections.reduce((sum, s) => sum + (Number(room.sectionReturns[s._id]) || 0), 0);
}

function roomAbsent(room) {
  if (!room.sections || !room.sectionReturns) return 0;
  return room.sections.reduce((sum, s) => {
    if (!Object.prototype.hasOwnProperty.call(room.sectionReturns, s._id)) return sum;
    return sum + Math.max((s.studentCount || 0) - (Number(room.sectionReturns[s._id]) || 0), 0);
  }, 0);
}

function calcStats(session) {
  if (!session || !session.rooms) {
    return { totalStudents: 0, totalPresent: 0, totalAbsent: 0, attendanceRate: 0, completedRooms: 0, activeRooms: 0, plannedRooms: 0 };
  }
  let totalStudents = 0, totalPresent = 0, totalAbsent = 0, completedRooms = 0, activeRooms = 0, plannedRooms = 0;
  session.rooms.forEach(room => {
    totalStudents += roomTotal(room);
    totalPresent += roomPresent(room);
    totalAbsent += roomAbsent(room);
    if (room.status === 'completed') completedRooms++;
    else if (room.status === 'active') activeRooms++;
    else if (room.status === 'planned') plannedRooms++;
  });
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  return { totalStudents, totalPresent, totalAbsent, attendanceRate, completedRooms, activeRooms, plannedRooms };
}

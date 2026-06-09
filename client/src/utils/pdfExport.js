import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Palette (RGB) — mirrors the styled Excel export / app brand (indigo).
const BRAND = [79, 70, 229];       // indigo-600
const BRAND_DARK = [67, 56, 202];  // indigo-700
const ZEBRA = [248, 250, 252];     // slate-50
const SLATE700 = [51, 65, 85];
const SLATE900 = [15, 23, 42];
const BORDER = [226, 232, 240];    // slate-200
const STATUS = {
  completed: { bg: [220, 252, 231], tx: [21, 128, 61] },
  active: { bg: [219, 234, 254], tx: [29, 78, 216] },
  planned: { bg: [254, 243, 199], tx: [180, 83, 9] },
};

/**
 * Export session data to a styled PDF document.
 * @param {Object} session - The session data to export
 * @param {string} filename - The base filename for the exported file
 */
export const exportSessionToPDF = (session, filename = 'testing-session') => {
  if (!session) {
    console.error('No session data provided for export');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
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
    margin: { top: 64, bottom: 34, left: margin, right: margin },
    styles: {
      font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: SLATE700,
      lineColor: BORDER, lineWidth: 0.5, overflow: 'linebreak', valign: 'middle',
    },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, halign: 'center', valign: 'middle' },
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

  let y = 64;
  const heading = (text) => {
    if (y > pageH - 90) { doc.addPage(); y = 64; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_DARK);
    doc.text(text, margin, y);
    y += 6;
  };
  const advance = () => { y = doc.lastAutoTable.finalY + 24; };

  // ── Session Summary ───────────────────────────────────────────────────────
  heading('Session Summary');
  autoTable(doc, tableBase({
    startY: y,
    body: [
      ['Status', (session.status || '—').toUpperCase()],
      ['Total Rooms', String(session.rooms?.length || 0)],
      ['Total Sections', String(session.sections?.length || 0)],
      ['Total Students', String(stats.totalStudents)],
      ['Present Students', String(stats.totalPresent)],
      ['Absent Students', String(stats.totalAbsent)],
      ['Attendance Rate', `${stats.attendanceRate}%`],
      ['Completed / Active / Planned Rooms', `${stats.completedRooms} / ${stats.activeRooms} / ${stats.plannedRooms}`],
      ['Exported', exportTs.toLocaleString()],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 240, textColor: SLATE700 },
      1: { textColor: SLATE900, fontStyle: 'bold' },
    },
  }));
  advance();

  // ── Rooms & Sections ──────────────────────────────────────────────────────
  heading('Rooms & Sections');
  autoTable(doc, tableBase({
    startY: y,
    head: [['Room', 'Status', 'Total', 'Present', 'Absent', 'Attendance', 'Sections', 'Supplies', 'Notes']],
    body: rowsOrNote((session.rooms || []).map(room => {
      const total = roomTotal(room);
      const present = room.presentStudents || 0;
      const absent = room.status === 'completed' ? total - present : '—';
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return [
        room.name || '', room.status || '', total, present, absent,
        (room.status === 'completed' || room.status === 'active') ? `${rate}%` : 'N/A',
        room.sections?.map(s => `Section ${s.number} (${s.studentCount})`).join(', ') || 'None',
        room.supplies?.join(', ') || 'None',
        room.notes || '',
      ];
    }), 9, 'No rooms found'),
    columnStyles: {
      2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 48 },
      4: { halign: 'center', cellWidth: 44 }, 5: { halign: 'center', cellWidth: 64 },
      6: { cellWidth: 150 }, 7: { cellWidth: 110 },
    },
    didParseCell: statusPainter(1),
  }));
  advance();

  // ── Sections ──────────────────────────────────────────────────────────────
  heading('Section Details');
  autoTable(doc, tableBase({
    startY: y,
    head: [['Section #', 'Students', 'Accommodations', 'Notes', 'Assigned Rooms']],
    body: rowsOrNote((session.sections || []).map(section => {
      const assignedRooms = session.rooms?.filter(room =>
        room.sections?.some(rs => rs._id === section._id)
      ).map(room => room.name).join(', ') || 'None';
      return [
        section.number || '', section.studentCount || 0,
        section.accommodations?.join(', ') || 'None', section.notes || '', assignedRooms,
      ];
    }), 5, 'No sections found'),
    columnStyles: { 0: { halign: 'center', cellWidth: 70 }, 1: { halign: 'center', cellWidth: 70 } },
  }));
  advance();

  // ── Proctors ──────────────────────────────────────────────────────────────
  const proctorRows = [];
  (session.rooms || []).forEach(room => {
    if (room.proctors && room.proctors.length > 0) {
      room.proctors.forEach(p => proctorRows.push([room.name || '', p.firstName || '', p.lastName || '', p.email || '', fmtTime(p.startTime), fmtTime(p.endTime)]));
    } else {
      proctorRows.push([room.name || '', 'No proctors assigned', '', '', '', '']);
    }
  });
  heading('Proctor Assignments');
  autoTable(doc, tableBase({
    startY: y,
    head: [['Room', 'First Name', 'Last Name', 'Email', 'Start', 'End']],
    body: rowsOrNote(proctorRows, 6, 'No rooms found'),
    columnStyles: { 4: { halign: 'center', cellWidth: 70 }, 5: { halign: 'center', cellWidth: 70 } },
  }));
  advance();

  // ── Activity Log ──────────────────────────────────────────────────────────
  heading('Activity Log');
  autoTable(doc, tableBase({
    startY: y,
    head: [['Timestamp', 'Action', 'User', 'Room', 'Details']],
    body: rowsOrNote((session.activityLog || []).map(a => [
      a.timestamp ? new Date(a.timestamp).toLocaleString() : '',
      a.action || '', a.userName || '', a.roomName || '', a.details || '',
    ]), 5, 'No activity log entries'),
    columnStyles: { 0: { cellWidth: 120 }, 2: { cellWidth: 100 }, 3: { cellWidth: 90 } },
  }));

  const finalName = `${filename}-${exportTs.toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`;
  doc.save(finalName);
};

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

function calcStats(session) {
  if (!session || !session.rooms) {
    return { totalStudents: 0, totalPresent: 0, totalAbsent: 0, attendanceRate: 0, completedRooms: 0, activeRooms: 0, plannedRooms: 0 };
  }
  let totalStudents = 0, totalPresent = 0, totalAbsent = 0, completedRooms = 0, activeRooms = 0, plannedRooms = 0;
  session.rooms.forEach(room => {
    const t = roomTotal(room);
    const p = room.presentStudents || 0;
    totalStudents += t;
    totalPresent += p;
    if (room.status === 'completed') totalAbsent += (t - p);
    if (room.status === 'completed') completedRooms++;
    else if (room.status === 'active') activeRooms++;
    else if (room.status === 'planned') plannedRooms++;
  });
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
  return { totalStudents, totalPresent, totalAbsent, attendanceRate, completedRooms, activeRooms, plannedRooms };
}

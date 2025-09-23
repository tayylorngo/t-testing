import * as XLSX from 'xlsx';

/**
 * Export session data to Excel format
 * @param {Object} session - The session data to export
 * @param {string} filename - The filename for the exported file
 */
export const exportSessionToExcel = (session, filename = 'testing-session') => {
  if (!session) {
    console.error('No session data provided for export');
    return;
  }

  // Capture current timestamp for the export
  const exportTimestamp = new Date();
  const exportDate = exportTimestamp.toLocaleDateString();
  const exportTime = exportTimestamp.toLocaleTimeString();

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Calculate real-time attendance statistics
  const attendanceStats = calculateAttendanceStatistics(session);

  // Sheet 1: Session Overview
  const sessionOverview = [
    ['Testing Session Details'],
    [''],
    ['Session Name:', session.name || ''],
    ['Description:', session.description || ''],
    ['Date:', session.date ? new Date(session.date).toLocaleDateString() : ''],
    ['Start Time:', session.startTime || ''],
    ['End Time:', session.endTime || ''],
    ['Status:', session.status || ''],
    ['Created By:', session.createdBy?.firstName + ' ' + session.createdBy?.lastName || ''],
    ['Created At:', session.createdAt ? new Date(session.createdAt).toLocaleString() : ''],
    [''],
    ['EXPORT INFORMATION'],
    ['Export Date:', exportDate],
    ['Export Time:', exportTime],
    [''],
    ['SESSION STATISTICS'],
    ['Total Rooms:', session.rooms?.length || 0],
    ['Total Sections:', session.sections?.length || 0],
    ['Total Students:', attendanceStats.totalStudents],
    [''],
    ['ATTENDANCE STATISTICS (At Time of Export)'],
    ['Present Students:', attendanceStats.totalPresent],
    ['Absent Students:', attendanceStats.totalAbsent],
    ['Attendance Rate:', `${attendanceStats.attendanceRate}%`],
    ['Completed Rooms:', attendanceStats.completedRooms],
    ['Active Rooms:', attendanceStats.activeRooms],
    ['Planned Rooms:', attendanceStats.plannedRooms],
  ];

  // Sheet 2: Rooms and Sections Details
  const roomsData = [
    ['Room Details'],
    [''],
    ['Room Name', 'Status', 'Total Students', 'Present Students', 'Absent Students', 'Attendance Rate', 'Sections', 'Supplies', 'Notes']
  ];

  if (session.rooms && session.rooms.length > 0) {
    session.rooms.forEach(room => {
      const totalStudents = calculateRoomTotalStudents(room);
      const presentStudents = room.presentStudents || 0;
      const absentStudents = room.status === 'completed' ? totalStudents - presentStudents : '-';
      const attendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;
      const sectionsList = room.sections?.map(s => `Section ${s.number} (${s.studentCount} students)`).join(', ') || 'None';
      const suppliesList = room.supplies?.join(', ') || 'None';
      
      roomsData.push([
        room.name || '',
        room.status || '',
        totalStudents,
        presentStudents,
        absentStudents,
        room.status === 'completed' || room.status === 'active' ? `${attendanceRate}%` : 'N/A',
        sectionsList,
        suppliesList,
        room.notes || ''
      ]);
    });
  } else {
    roomsData.push(['No rooms found']);
  }

  // Sheet 3: Sections Details
  const sectionsData = [
    ['Section Details'],
    [''],
    ['Section Number', 'Student Count', 'Accommodations', 'Notes', 'Assigned Rooms']
  ];

  if (session.sections && session.sections.length > 0) {
    session.sections.forEach(section => {
      const assignedRooms = session.rooms?.filter(room => 
        room.sections?.some(roomSection => roomSection._id === section._id)
      ).map(room => room.name).join(', ') || 'None';
      
      sectionsData.push([
        section.number || '',
        section.studentCount || 0,
        section.accommodations?.join(', ') || 'None',
        section.notes || '',
        assignedRooms
      ]);
    });
  } else {
    sectionsData.push(['No sections found']);
  }

  // Sheet 4: Proctors Details
  const proctorsData = [
    ['Proctors Details'],
    [''],
    ['Room Name', 'First Name', 'Last Name', 'Email', 'Start Time', 'End Time']
  ];

  if (session.rooms && session.rooms.length > 0) {
    session.rooms.forEach(room => {
      if (room.proctors && room.proctors.length > 0) {
        room.proctors.forEach(proctor => {
          proctorsData.push([
            room.name || '',
            proctor.firstName || '',
            proctor.lastName || '',
            proctor.email || '',
            proctor.startTime || '',
            proctor.endTime || ''
          ]);
        });
      } else {
        proctorsData.push([room.name || '', 'No proctors assigned', '', '', '', '']);
      }
    });
  } else {
    proctorsData.push(['No rooms found']);
  }

  // Sheet 5: Activity Log
  const activityData = [
    ['Activity Log'],
    [''],
    ['Timestamp', 'Action', 'User', 'Room', 'Details']
  ];

  if (session.activityLog && session.activityLog.length > 0) {
    session.activityLog.forEach(activity => {
      activityData.push([
        activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '',
        activity.action || '',
        activity.userName || '',
        activity.roomName || '',
        activity.details || ''
      ]);
    });
  } else {
    activityData.push(['No activity log entries']);
  }

  // Sheet 6: Attendance Summary
  const attendanceData = [
    ['Attendance Summary'],
    [''],
    ['Export Information:'],
    ['Export Date:', exportDate],
    ['Export Time:', exportTime],
    [''],
    ['Overall Statistics:'],
    ['Total Students:', attendanceStats.totalStudents],
    ['Present Students:', attendanceStats.totalPresent],
    ['Absent Students:', attendanceStats.totalAbsent],
    ['Attendance Rate:', `${attendanceStats.attendanceRate}%`],
    [''],
    ['Room Status Breakdown:'],
    ['Completed Rooms:', attendanceStats.completedRooms],
    ['Active Rooms:', attendanceStats.activeRooms],
    ['Planned Rooms:', attendanceStats.plannedRooms],
    [''],
    ['Room-by-Room Attendance:'],
    ['Room Name', 'Status', 'Total Students', 'Present', 'Absent', 'Attendance Rate']
  ];

  // Add room-by-room attendance details
  if (session.rooms && session.rooms.length > 0) {
    session.rooms.forEach(room => {
      const totalStudents = calculateRoomTotalStudents(room);
      const presentStudents = room.presentStudents || 0;
      const absentStudents = room.status === 'completed' ? totalStudents - presentStudents : '-';
      const attendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;
      
      attendanceData.push([
        room.name || '',
        room.status || '',
        totalStudents,
        presentStudents,
        absentStudents,
        room.status === 'completed' || room.status === 'active' ? `${attendanceRate}%` : 'N/A'
      ]);
    });
  } else {
    attendanceData.push(['No rooms found']);
  }

  // Create worksheets
  const ws1 = XLSX.utils.aoa_to_sheet(sessionOverview);
  const ws2 = XLSX.utils.aoa_to_sheet(roomsData);
  const ws3 = XLSX.utils.aoa_to_sheet(sectionsData);
  const ws4 = XLSX.utils.aoa_to_sheet(proctorsData);
  const ws5 = XLSX.utils.aoa_to_sheet(activityData);
  const ws6 = XLSX.utils.aoa_to_sheet(attendanceData);

  // Set column widths for better formatting
  const setColumnWidths = (ws, widths) => {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  };

  setColumnWidths(ws1, [25, 50]);
  setColumnWidths(ws2, [20, 12, 15, 15, 15, 15, 30, 30, 30]);
  setColumnWidths(ws3, [15, 15, 30, 30, 30]);
  setColumnWidths(ws4, [20, 15, 15, 25, 15, 15]);
  setColumnWidths(ws5, [20, 20, 20, 20, 40]);
  setColumnWidths(ws6, [25, 50]);

  // Add worksheets to workbook
  XLSX.utils.book_append_sheet(workbook, ws1, 'Session Overview');
  XLSX.utils.book_append_sheet(workbook, ws2, 'Rooms & Sections');
  XLSX.utils.book_append_sheet(workbook, ws3, 'Sections Details');
  XLSX.utils.book_append_sheet(workbook, ws4, 'Proctors');
  XLSX.utils.book_append_sheet(workbook, ws5, 'Activity Log');
  XLSX.utils.book_append_sheet(workbook, ws6, 'Attendance Summary');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const finalFilename = `${filename}-${timestamp}.xlsx`;

  // Export the file
  XLSX.writeFile(workbook, finalFilename);
};

/**
 * Calculate total students across all sections in a session
 */
const calculateTotalStudents = (session) => {
  if (!session.sections) return 0;
  return session.sections.reduce((total, section) => total + (section.studentCount || 0), 0);
};

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
      plannedRooms: 0
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
    plannedRooms
  };
};


export interface AttendanceRecord {
  status: 'present' | 'absent';
  timestamp: number;
  attendancePercentageAfter: number;
}

export interface TimetableSlot {
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    time: string;
    subjectName?: string;
    teacherName?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  fileName: string;
  fileType: string;
  uploadDate: number;
}

export interface Subject {
  id: string;
  name:string;
  professor: string;
  present: number;
  total: number;
  history: AttendanceRecord[];
  color: string;
  timetable?: TimetableSlot[];
  notes?: Note[];
}

export interface Message {
  sender: 'user' | 'ai';
  text: string;
}

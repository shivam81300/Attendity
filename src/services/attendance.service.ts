import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Subject, AttendanceRecord, TimetableSlot, Note } from '../models/subject.model';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'attendance-data';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private storageService = inject(StorageService);
  
  readonly subjects = signal<Subject[]>([]);
  
  readonly colors = [
    '#6366f1', // indigo
    '#a855f7', // purple
    '#ec4899', // pink
    '#f97316', // orange
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#84cc16'  // lime
  ];

  readonly overallStats = computed(() => {
    const allSubjects = this.subjects();
    const totalPresent = allSubjects.reduce((acc, s) => acc + s.present, 0);
    const totalClasses = allSubjects.reduce((acc, s) => acc + s.total, 0);
    const percentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 0;
    return { totalPresent, totalClasses, percentage };
  });
  
  readonly todaysSchedule = computed(() => {
    const today = new Date().toLocaleString('en-US', { weekday: 'short' }); // "Mon", "Tue", etc.
    const schedule: { subject: Subject; slot: TimetableSlot }[] = [];
    
    this.subjects().forEach(subject => {
      subject.timetable?.forEach(slot => {
        if (slot.day === today) {
          schedule.push({ subject, slot });
        }
      });
    });
    
    return schedule.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
  });

  readonly todaysStats = computed(() => {
    const todayDateString = new Date().toDateString();
    let marked = 0;
    let present = 0;

    // Iterate over all subjects to find attendance marked today,
    // not just subjects scheduled for today. This is more robust.
    for (const subject of this.subjects()) {
        const todaysHistory = subject.history.filter(h => new Date(h.timestamp).toDateString() === todayDateString);
        if (todaysHistory.length > 0) {
            marked += todaysHistory.length;
            present += todaysHistory.filter(h => h.status === 'present').length;
        }
    }

    return { present, marked };
  });

  readonly attendanceByDayOfWeek = computed(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const stats = new Map<string, { present: number; total: number }>();
    days.forEach(day => stats.set(day, { present: 0, total: 0 }));

    const allHistory = this.subjects().flatMap(s => s.history);

    for (const record of allHistory) {
        const date = new Date(record.timestamp);
        const dayOfWeek = days[(date.getDay() + 6) % 7]; // Monday is 0
        const dayStat = stats.get(dayOfWeek)!;
        
        dayStat.total++;
        if (record.status === 'present') {
            dayStat.present++;
        }
    }

    return days.map(day => {
        const dayStat = stats.get(day)!;
        return {
            day,
            ...dayStat,
            percentage: dayStat.total > 0 ? (dayStat.present / dayStat.total) * 100 : 0
        };
    });
  });
  
  readonly attendanceForTimeframes = computed(() => {
    const allHistory = this.subjects().flatMap(s => s.history);

    const today = new Date();
    today.setHours(0,0,0,0);

    const thisWeekStart = new Date(today);
    const dayOfWeek = today.getDay(); // Sun = 0
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    thisWeekStart.setDate(diff);
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    lastMonthEnd.setHours(23,59,59,999);

    const timeframes = {
        thisWeek: { present: 0, total: 0 },
        lastWeek: { present: 0, total: 0 },
        thisMonth: { present: 0, total: 0 },
        lastMonth: { present: 0, total: 0 },
    };

    for (const record of allHistory) {
        const recordDate = new Date(record.timestamp);
        
        if (recordDate >= thisWeekStart) {
            timeframes.thisWeek.total++;
            if (record.status === 'present') timeframes.thisWeek.present++;
        } else if (recordDate >= lastWeekStart && recordDate < thisWeekStart) {
            timeframes.lastWeek.total++;
            if (record.status === 'present') timeframes.lastWeek.present++;
        }

        if (recordDate >= thisMonthStart) {
            timeframes.thisMonth.total++;
            if (record.status === 'present') timeframes.thisMonth.present++;
        } else if (recordDate >= lastMonthStart && recordDate <= lastMonthEnd) {
            timeframes.lastMonth.total++;
            if (record.status === 'present') timeframes.lastMonth.present++;
        }
    }
    
    const calculatePercentage = (p: number, t: number) => t > 0 ? (p / t) * 100 : 0;

    return {
        thisWeek: { ...timeframes.thisWeek, percentage: calculatePercentage(timeframes.thisWeek.present, timeframes.thisWeek.total) },
        lastWeek: { ...timeframes.lastWeek, percentage: calculatePercentage(timeframes.lastWeek.present, timeframes.lastWeek.total) },
        thisMonth: { ...timeframes.thisMonth, percentage: calculatePercentage(timeframes.thisMonth.present, timeframes.thisMonth.total) },
        lastMonth: { ...timeframes.lastMonth, percentage: calculatePercentage(timeframes.lastMonth.present, timeframes.lastMonth.total) },
    };
  });

  constructor() {
    const savedSubjects = this.storageService.getItem<Subject[]>(STORAGE_KEY);
    if (savedSubjects) {
      this.subjects.set(savedSubjects);
    }

    effect(() => {
      this.storageService.setItem(STORAGE_KEY, this.subjects());
    });
  }

  addSubject(subjectData: { name: string, professor: string, color: string, timetable: TimetableSlot[] }) {
    if (!subjectData.name.trim()) return;
    const newSubject: Subject = {
      id: crypto.randomUUID(),
      name: subjectData.name.trim(),
      professor: subjectData.professor.trim(),
      present: 0,
      total: 0,
      history: [],
      color: subjectData.color,
      timetable: subjectData.timetable,
      notes: [],
    };
    this.subjects.update(subjects => [...subjects, newSubject]);
  }

  deleteSubject(id: string) {
    this.subjects.update(subjects => subjects.filter(s => s.id !== id));
  }
  
  updateSubjectName(id: string, newName: string, newProfessor: string) {
    this.subjects.update(subjects => 
      subjects.map(s => s.id === id ? { ...s, name: newName.trim(), professor: newProfessor.trim() } : s)
    );
  }

  private updateAttendance(id: string, isPresent: boolean) {
    this.subjects.update(subjects => subjects.map(s => {
      if (s.id !== id) return s;

      const newPresent = isPresent ? s.present + 1 : s.present;
      const newTotal = s.total + 1;
      const percentage = (newPresent / newTotal) * 100;
      
      const newRecord: AttendanceRecord = {
          status: isPresent ? 'present' : 'absent',
          timestamp: Date.now(),
          attendancePercentageAfter: percentage
      };
      
      return { 
        ...s, 
        present: newPresent,
        total: newTotal,
        history: [...s.history, newRecord]
      };
    }));
  }

  markPresent(id: string) {
    this.updateAttendance(id, true);
  }

  markAbsent(id: string) {
    this.updateAttendance(id, false);
  }
  
  undoLastAction(id: string) {
    this.subjects.update(subjects => subjects.map(s => {
        if (s.id !== id || s.history.length === 0) return s;

        const lastAction = s.history[s.history.length - 1];
        const newHistory = s.history.slice(0, -1);
        const newTotal = s.total - 1;
        const newPresent = lastAction.status === 'present' ? s.present - 1 : s.present;

        return {
            ...s,
            present: newPresent,
            total: newTotal,
            history: newHistory
        };
    }));
  }
  
  addNote(subjectId: string, note: Omit<Note, 'id' | 'uploadDate'>) {
      const newNote: Note = {
          ...note,
          id: crypto.randomUUID(),
          uploadDate: Date.now()
      };
      this.subjects.update(subjects => subjects.map(s => {
          if (s.id === subjectId) {
              return { ...s, notes: [...(s.notes || []), newNote] };
          }
          return s;
      }));
  }

  deleteNote(subjectId: string, noteId: string) {
      this.subjects.update(subjects => subjects.map(s => {
          if (s.id === subjectId) {
              return { ...s, notes: (s.notes || []).filter(n => n.id !== noteId) };
          }
          return s;
      }));
  }

  resetAllData() {
    this.subjects.set([]);
    this.storageService.removeItem(STORAGE_KEY);
  }
}
import { Component, ChangeDetectionStrategy, inject, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { Subject, TimetableSlot } from '../../models/subject.model';
import { AddSubjectModalComponent } from '../add-subject-modal/add-subject-modal.component';
import { WhatIfModalComponent } from '../what-if-modal/what-if-modal.component';

@Component({
  selector: 'app-subject-list',
  standalone: true,
  imports: [CommonModule, AddSubjectModalComponent, WhatIfModalComponent],
  templateUrl: './subject-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectListComponent {
  attendanceService = inject(AttendanceService);
  
  showAddSubjectModal = signal(false);
  showWhatIfModal = signal(false);

  editingSubjectId = signal<string | null>(null);
  editingSubjectName = signal('');
  editingProfessorName = signal('');
  
  whatIfClasses = signal(1);
  actionStates = signal<{ [key: string]: 'present' | 'absent' | 'undo' | undefined }>({});
  
  subjects = this.attendanceService.subjects;
  overallStats = this.attendanceService.overallStats;
  todaysSchedule = this.attendanceService.todaysSchedule;
  todaysStats = this.attendanceService.todaysStats;

  private triggerAnimation(subjectId: string, action: 'present' | 'absent' | 'undo') {
    this.actionStates.update(states => ({ ...states, [subjectId]: action }));
    setTimeout(() => {
        this.actionStates.update(states => {
            const newStates = { ...states };
            delete newStates[subjectId];
            return newStates;
        });
    }, 500); // Animation duration should match CSS
  }
  
  getSubjectTodaysStats(subjectId: string): { marked: number, total: number } {
      const todayDateString = new Date().toDateString();
      const subject = this.subjects().find(s => s.id === subjectId);
      if (!subject) return { marked: 0, total: 0 };
      
      const marked = subject.history.filter(h => new Date(h.timestamp).toDateString() === todayDateString).length;
      const total = this.todaysSchedule().filter(s => s.subject.id === subjectId).length;
      
      return { marked, total };
  }

  markPresent(subjectId: string) {
    const dailyStats = this.getSubjectTodaysStats(subjectId);
    if (dailyStats.total > 0 && dailyStats.marked >= dailyStats.total) return;
    this.attendanceService.markPresent(subjectId);
    this.triggerAnimation(subjectId, 'present');
  }

  markAbsent(subjectId: string) {
    const dailyStats = this.getSubjectTodaysStats(subjectId);
    if (dailyStats.total > 0 && dailyStats.marked >= dailyStats.total) return;
    this.attendanceService.markAbsent(subjectId);
    this.triggerAnimation(subjectId, 'absent');
  }

  undoLastAction(subjectId: string, subject: Subject) {
    if (subject.history.length === 0) return;
    this.attendanceService.undoLastAction(subjectId);
    this.triggerAnimation(subjectId, 'undo');
  }

  getPercentage(present: number, total: number): number {
    if (total === 0) return 0;
    return (present / total) * 100;
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 75) return 'text-green-500';
    return 'text-red-500';
  }
  
  getProgressBarColor(percentage: number): string {
    if (percentage >= 75) return 'bg-green-500';
    return 'bg-red-500';
  }

  calculateSafetyInfo(present: number, total: number): { status: 'safe' | 'unsafe' | 'na', value: string } {
    if (total === 0) {
        return { status: 'na', value: 'Mark attendance to see stats' };
    }
    const percentage = this.getPercentage(present, total);
    if (percentage >= 75) {
        const bunkable = Math.floor((4 * present - 3 * total) / 3);
        return { status: 'safe', value: `You can bunk ${bunkable} more class(es).` };
    }
    const needed = Math.ceil((3 * total - 4 * present));
    return { status: 'unsafe', value: `Attend the next ${needed} class(es) to recover.` };
  }

  calculateWhatIf(present: number, total: number): number {
    const futureClasses = this.whatIfClasses() || 0;
    if (total + futureClasses === 0) return 0;
    return ((present + futureClasses) / (total + futureClasses)) * 100;
  }

  onAddSubject(subjectData: { name: string, professor: string, color: string, timetable: TimetableSlot[] }) {
    this.attendanceService.addSubject(subjectData);
    this.showAddSubjectModal.set(false);
  }
  
  startEditing(subject: Subject) {
    this.editingSubjectId.set(subject.id);
    this.editingSubjectName.set(subject.name);
    this.editingProfessorName.set(subject.professor);
  }

  saveEdit(subjectId: string) {
    if (this.editingSubjectName().trim()) {
        this.attendanceService.updateSubjectName(subjectId, this.editingSubjectName(), this.editingProfessorName());
    }
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingSubjectId.set(null);
    this.editingSubjectName.set('');
    this.editingProfessorName.set('');
  }
}
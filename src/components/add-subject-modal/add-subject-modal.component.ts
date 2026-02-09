
import { Component, ChangeDetectionStrategy, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { TimetableSlot } from '../../models/subject.model';
import { TimetableImportModalComponent } from '../timetable-import-modal/timetable-import-modal.component';

type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

@Component({
  selector: 'app-add-subject-modal',
  standalone: true,
  imports: [CommonModule, TimetableImportModalComponent],
  templateUrl: './add-subject-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddSubjectModalComponent {
  attendanceService = inject(AttendanceService);
  close = output<void>();
  add = output<{ name: string, professor: string, color: string, timetable: TimetableSlot[] }>();

  name = signal('');
  professor = signal('');
  
  timetable = signal<TimetableSlot[]>([]);
  newSlotDay = signal<Day>('Mon');
  newSlotTime = signal('09:00');
  
  colors = this.attendanceService.colors;
  selectedColor = signal(this.colors[0]);

  days: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  showImportModal = signal(false);

  addSlot() {
    this.timetable.update(slots => [
        ...slots,
        { day: this.newSlotDay(), time: this.newSlotTime() }
    ]);
  }

  removeSlot(index: number) {
    this.timetable.update(slots => slots.filter((_, i) => i !== index));
  }

  handleTimetableImport(slots: TimetableSlot[]) {
    if (slots.length === 0) {
        this.showImportModal.set(false);
        return;
    }
    
    const subjectsToCreate = new Map<string, { teacherName: string, timetable: {day: Day, time: string}[] }>();

    for (const slot of slots) {
      if (!slot.subjectName) continue;
      
      const subjectKey = slot.subjectName.trim();
      if (!subjectsToCreate.has(subjectKey)) {
        subjectsToCreate.set(subjectKey, {
          teacherName: slot.teacherName?.trim() || '',
          timetable: []
        });
      }

      const subjectEntry = subjectsToCreate.get(subjectKey)!;
      // Ensure we don't add duplicate timetable slots
      const slotExists = subjectEntry.timetable.some(s => s.day === slot.day && s.time === slot.time);
      if(!slotExists) {
        subjectEntry.timetable.push({ day: slot.day, time: slot.time });
      }
      
      if (slot.teacherName && !subjectEntry.teacherName) {
        subjectEntry.teacherName = slot.teacherName.trim();
      }
    }

    let colorIndex = this.attendanceService.subjects().length % this.colors.length;
    subjectsToCreate.forEach((data, name) => {
      this.attendanceService.addSubject({
        name: name,
        professor: data.teacherName,
        color: this.colors[colorIndex],
        timetable: data.timetable
      });
      colorIndex = (colorIndex + 1) % this.colors.length;
    });

    this.showImportModal.set(false);
    this.close.emit();
  }

  submit() {
    if (this.name().trim()) {
      this.add.emit({
        name: this.name(),
        professor: this.professor(),
        color: this.selectedColor(),
        timetable: this.timetable()
      });
    }
  }
}

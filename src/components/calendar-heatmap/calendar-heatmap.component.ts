import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from '../../models/subject.model';

interface DayData {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  attendance?: {
    present: number;
    total: number;
    percentage: number;
  };
}

type CalendarDisplayMode = 'heatmap' | 'counts' | 'threshold';

@Component({
  selector: 'app-calendar-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-heatmap.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarHeatmapComponent {
  subjects = input.required<Subject[]>();
  
  currentDate = signal(new Date());
  displayMode = signal<CalendarDisplayMode>('heatmap');

  private dailyAttendanceData = computed(() => {
    const dailyData = new Map<string, { present: number; total: number }>();
    this.subjects().forEach(subject => {
      subject.history.forEach(record => {
        const dateKey = new Date(record.timestamp).toDateString();
        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, { present: 0, total: 0 });
        }
        const dayStats = dailyData.get(dateKey)!;
        dayStats.total++;
        if (record.status === 'present') {
          dayStats.present++;
        }
      });
    });
    return dailyData;
  });

  calendarGrid = computed<DayData[]>(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const totalDays = lastDayOfMonth.getDate();

    const grid: DayData[] = [];
    
    // Add days from previous month to fill the first week
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDate = new Date(year, month, 0);
      prevMonthDate.setDate(prevMonthDate.getDate() - i);
      grid.unshift({
        date: prevMonthDate,
        dayOfMonth: prevMonthDate.getDate(),
        isCurrentMonth: false,
      });
    }

    // Add days for the current month
    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(year, month, day);
      const dateKey = currentDate.toDateString();
      const attendance = this.dailyAttendanceData().get(dateKey);
      
      grid.push({
        date: currentDate,
        dayOfMonth: day,
        isCurrentMonth: true,
        attendance: attendance && attendance.total > 0 ? { ...attendance, percentage: (attendance.present / attendance.total) * 100 } : undefined,
      });
    }

    // Add days from next month to fill the last week
    const gridEndIndex = grid.length;
    const daysToAdd = (7 - (gridEndIndex % 7)) % 7;
    for (let i = 1; i <= daysToAdd; i++) {
        const nextMonthDate = new Date(year, month + 1, i);
        grid.push({
            date: nextMonthDate,
            dayOfMonth: nextMonthDate.getDate(),
            isCurrentMonth: false,
        });
    }

    return grid;
  });

  changeMonth(offset: number) {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      newDate.setMonth(d.getMonth() + offset);
      return newDate;
    });
  }

  setDisplayMode(mode: CalendarDisplayMode) {
    this.displayMode.set(mode);
  }

  getHeatmapColor(percentage: number | undefined): string {
    if (percentage === undefined) return 'bg-slate-100';
    if (percentage >= 90) return 'bg-green-600 text-white';
    if (percentage >= 75) return 'bg-green-400';
    if (percentage >= 60) return 'bg-yellow-400';
    if (percentage >= 40) return 'bg-orange-400';
    return 'bg-red-500 text-white';
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
}

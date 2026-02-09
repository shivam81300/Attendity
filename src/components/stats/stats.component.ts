
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsComponent {
  attendanceService = inject(AttendanceService);
  subjects = this.attendanceService.subjects;

  getPercentage(present: number, total: number): number {
    if (total === 0) return 0;
    return (present / total) * 100;
  }
}

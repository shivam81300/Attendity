import { Component, ChangeDetectionStrategy, inject, viewChild, ElementRef, afterNextRender, effect, OnDestroy, computed, Injector, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { TrendChartComponent } from '../trend-chart/trend-chart.component';
import { Subject, AttendanceRecord } from '../../models/subject.model';
import { CalendarHeatmapComponent } from '../calendar-heatmap/calendar-heatmap.component';

declare var Chart: any;

type ChartType = 'bar' | 'doughnut';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, TrendChartComponent, CalendarHeatmapComponent],
  templateUrl: './analytics-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboardComponent implements OnDestroy {
  attendanceService = inject(AttendanceService);
  injector = inject(Injector);
  subjects = this.attendanceService.subjects;
  overallStats = this.attendanceService.overallStats;
  attendanceByDayOfWeek = this.attendanceService.attendanceByDayOfWeek;
  attendanceForTimeframes = this.attendanceService.attendanceForTimeframes;

  barChartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('barChart');
  overallChartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('overallChart');
  dayOfWeekChartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('dayOfWeekChart');
  
  activeTab = signal<'overview' | 'trends' | 'calendar'>('overview');
  selectedSubjectIdForTrend = signal<string | null>(null);

  private charts: { [key: string]: any } = {};

  hasDayOfWeekData = computed(() => {
    return this.attendanceByDayOfWeek().some(d => d.total > 0);
  });

  mostAttendedSubject = computed(() => {
    const sortedSubjects = [...this.subjects()].sort((a, b) => {
        const percA = a.total > 0 ? (a.present / a.total) : 0;
        const percB = b.total > 0 ? (b.present / b.total) : 0;
        return percB - percA;
    });
    return sortedSubjects.length > 0 ? sortedSubjects[0] : null;
  });

  highestRiskSubject = computed(() => {
    const sortedSubjects = [...this.subjects()]
        .filter(s => s.total > 0)
        .sort((a, b) => {
            const percA = a.total > 0 ? (a.present / a.total) : 0;
            const percB = b.total > 0 ? (b.present / b.total) : 0;
            return percA - percB;
        });
    return sortedSubjects.length > 0 ? sortedSubjects[0] : null;
  });

  overallTrendSubject = computed<Subject | null>(() => {
    const allSubjects = this.subjects();
    if (allSubjects.length === 0) return null;

    const combinedHistory: AttendanceRecord[] = allSubjects.flatMap(s => s.history);
    const stats = this.overallStats();

    return {
      id: 'overall',
      name: 'Overall Attendance',
      professor: 'All Subjects',
      present: stats.totalPresent,
      total: stats.totalClasses,
      history: combinedHistory,
      color: '#5E56F0', // primary color
      timetable: []
    };
  });

  selectedSubjectForTrend = computed(() => {
      const subjectId = this.selectedSubjectIdForTrend();
      if (subjectId === 'overall') {
          return this.overallTrendSubject();
      }
      if (!subjectId) return null;
      return this.subjects().find(s => s.id === subjectId) ?? null;
  });

  constructor() {
    afterNextRender(() => {
      effect(() => {
        // Initialize selected subject for trend view when subjects load
        const currentSubjects = this.subjects();
        if (currentSubjects.length > 0 && !this.selectedSubjectIdForTrend()) {
            this.selectedSubjectIdForTrend.set('overall');
        }
        
        if(this.activeTab() === 'overview') {
            this.updateBarChart();
            this.updateOverallChart();
            this.updateDayOfWeekChart();
        }
      }, { injector: this.injector });
    });
  }

  ngOnDestroy(): void {
    Object.values(this.charts).forEach(chart => chart.destroy());
  }
  
  private createOrUpdateChart(type: ChartType, canvasEl: ElementRef<HTMLCanvasElement> | undefined, chartId: string, data: any, options: any) {
    if (!canvasEl) return;
    
    if (this.charts[chartId]) {
      this.charts[chartId].data = data;
      this.charts[chartId].options = options;
      this.charts[chartId].update();
    } else {
      Chart.defaults.color = '#64748b'; // slate-500
      Chart.defaults.font.family = 'sans-serif';

      this.charts[chartId] = new Chart(canvasEl.nativeElement, {
        type,
        data,
        options
      });
    }
  }

  updateBarChart() {
    const subjects = this.subjects();
    if (subjects.length === 0) {
      if(this.charts['bar']) {
        this.charts['bar'].destroy();
        delete this.charts['bar'];
      }
      return;
    };

    const data = {
      labels: subjects.map(s => s.name),
      datasets: [{
        label: 'Attendance %',
        data: subjects.map(s => s.total > 0 ? (s.present / s.total) * 100 : 0),
        backgroundColor: subjects.map(s => s.color + 'BF'), // Add alpha
        borderColor: subjects.map(s => s.color),
        borderWidth: 1,
        borderRadius: 4,
      }]
    };
    
    const options = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0'} },
        y: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
            enabled: true,
            callbacks: {
                label: (context: any) => ` ${context.raw.toFixed(1)}%`
            }
        }
      }
    };
    this.createOrUpdateChart('bar', this.barChartCanvas(), 'bar', data, options);
  }
  
  updateOverallChart() {
    const stats = this.overallStats();
    if (stats.totalClasses === 0) {
        if(this.charts['overall']) {
            this.charts['overall'].destroy();
            delete this.charts['overall'];
        }
        return;
    };

    const data = {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: [stats.totalPresent, stats.totalClasses - stats.totalPresent],
        backgroundColor: ['#22c55e', '#ef4444'], // green-500, red-600
        borderColor: '#f8fafc', // bg-slate-50
        borderWidth: 4,
        hoverOffset: 8
      }]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: { 
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    boxWidth: 15,
                    font: {
                        size: 14
                    }
                }
            },
            tooltip: {
                enabled: true,
                 callbacks: {
                    label: (context: any) => ` ${context.label}: ${context.raw} classes`
                }
            }
        }
    };
    this.createOrUpdateChart('doughnut', this.overallChartCanvas(), 'overall', data, options);
  }

  updateDayOfWeekChart() {
    const dayData = this.attendanceByDayOfWeek();
    if (!this.hasDayOfWeekData()) {
      if(this.charts['dayOfWeek']) {
        this.charts['dayOfWeek'].destroy();
        delete this.charts['dayOfWeek'];
      }
      return;
    };

    const data = {
      labels: dayData.map(d => d.day),
      datasets: [{
        label: 'Attendance %',
        data: dayData.map(d => d.percentage),
        backgroundColor: '#a855f7BF', // purple-500 with alpha
        borderColor: '#a855f7', // purple-500
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 20,
      }]
    };
    
    const options = {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0'} },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
            enabled: true,
            callbacks: {
                label: (context: any) => ` Attendance: ${context.raw.toFixed(1)}%`
            }
        }
      }
    };
    this.createOrUpdateChart('bar', this.dayOfWeekChartCanvas(), 'dayOfWeek', data, options);
  }
}
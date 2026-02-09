
import { Component, ChangeDetectionStrategy, input, viewChild, ElementRef, afterNextRender, effect, OnDestroy, signal, Injector, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject as SubjectData } from '../../models/subject.model';

declare var Chart: any;

interface GroupedAttendance {
    [key: string]: { present: number; total: number };
}

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trend-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendChartComponent implements OnDestroy {
  subject = input.required<SubjectData>();
  // FIX: Imported inject from @angular/core
  injector = inject(Injector);

  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('trendChart');
  activeTrendView = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  
  private chart: any;

  private chartData = computed(() => {
    const sub = this.subject();
    if (!sub || !sub.history || sub.history.length === 0) return null;

    const history = [...sub.history].sort((a, b) => a.timestamp - b.timestamp);
    let groupedData: GroupedAttendance = {};

    switch(this.activeTrendView()) {
        case 'daily':
            groupedData = this.groupByDay(history);
            break;
        case 'weekly':
            groupedData = this.groupByWeek(history);
            break;
        case 'monthly':
            groupedData = this.groupByMonth(history);
            break;
    }

    const labels = Object.keys(groupedData);
    const data = labels.map(key => {
        const item = groupedData[key];
        return item.total > 0 ? (item.present / item.total) * 100 : 0;
    });

    return { labels, data };
  });

  constructor() {
    afterNextRender(() => {
      effect(() => this.updateChart(), { injector: this.injector });
    });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
  
  private groupByDay(history: SubjectData['history']): GroupedAttendance {
    return history.reduce((acc, record) => {
        const date = new Date(record.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (!acc[date]) {
            acc[date] = { present: 0, total: 0 };
        }
        if (record.status === 'present') {
            acc[date].present++;
        }
        acc[date].total++;
        return acc;
    }, {} as GroupedAttendance);
  }

  private getWeekLabel(date: Date): string {
    const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
    const lastDay = new Date(date.setDate(date.getDate() - date.getDay() + 6));
    return `${firstDay.toLocaleDateString('en-CA')} to ${lastDay.toLocaleDateString('en-CA')}`;
  }

  private groupByWeek(history: SubjectData['history']): GroupedAttendance {
    return history.reduce((acc, record) => {
        const weekLabel = this.getWeekLabel(new Date(record.timestamp));
        if (!acc[weekLabel]) {
            acc[weekLabel] = { present: 0, total: 0 };
        }
        if (record.status === 'present') {
            acc[weekLabel].present++;
        }
        acc[weekLabel].total++;
        return acc;
    }, {} as GroupedAttendance);
  }

  private groupByMonth(history: SubjectData['history']): GroupedAttendance {
    return history.reduce((acc, record) => {
        const month = new Date(record.timestamp).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!acc[month]) {
            acc[month] = { present: 0, total: 0 };
        }
        if (record.status === 'present') {
            acc[month].present++;
        }
        acc[month].total++;
        return acc;
    }, {} as GroupedAttendance);
  }

  private updateChart() {
    const chartData = this.chartData();
    if (!this.chartCanvas() || !chartData) {
        if (this.chart) this.chart.destroy();
        this.chart = null;
        return;
    };
    
    const data = {
      labels: chartData.labels,
      datasets: [{
        label: 'Attendance %',
        data: chartData.data,
        fill: true,
        borderColor: this.subject().color,
        backgroundColor: this.subject().color + '33', // Add alpha
        tension: 0.2,
        pointRadius: 4,
        pointBackgroundColor: this.subject().color
      }]
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#e2e8f0' } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
         tooltip: {
            callbacks: {
                label: function(context: any) {
                    return ` Attendance: ${context.raw.toFixed(1)}%`;
                }
            }
        }
      }
    };

    if (this.chart) {
      this.chart.data = data;
      this.chart.options = options;
      this.chart.update();
    } else {
      this.chart = new Chart(this.chartCanvas()!.nativeElement, {
        type: 'line',
        data,
        options
      });
    }
  }
}

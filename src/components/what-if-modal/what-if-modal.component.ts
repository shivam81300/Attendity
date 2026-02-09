import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-what-if-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './what-if-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhatIfModalComponent {
  stats = input.required<{ totalPresent: number; totalClasses: number; percentage: number }>();
  close = output<void>();

  futurePresent = signal(0);
  futureAbsent = signal(0);

  projectedStats = computed(() => {
    const currentPresent = this.stats().totalPresent;
    const currentTotal = this.stats().totalClasses;

    const projectedPresent = currentPresent + this.futurePresent();
    const projectedTotal = currentTotal + this.futurePresent() + this.futureAbsent();
    
    const percentage = projectedTotal > 0 ? (projectedPresent / projectedTotal) * 100 : 0;
    
    return {
      present: projectedPresent,
      total: projectedTotal,
      percentage: percentage
    };
  });

  getPercentageColor(percentage: number): string {
    if (percentage >= 75) return 'text-green-500';
    return 'text-red-500';
  }

  reset() {
    this.futurePresent.set(0);
    this.futureAbsent.set(0);
  }
}
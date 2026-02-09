
import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpModalComponent {
  close = output<void>();
}

import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type InfoSection = 'faq' | 'about' | 'privacy' | 'contact';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPageComponent {
  activeSection = signal<InfoSection>('faq');

  setSection(section: InfoSection) {
    this.activeSection.set(section);
  }
}

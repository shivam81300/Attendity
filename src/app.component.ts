import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubjectListComponent } from './components/subject-list/subject-list.component';
import { AnalyticsDashboardComponent } from './components/analytics-dashboard/analytics-dashboard.component';
import { HelpModalComponent } from './components/help-modal/help-modal.component';
import { AttendanceService } from './services/attendance.service';
import { AiChatComponent } from './components/ai-chat/ai-chat.component';
import { StatsComponent } from './components/stats/stats.component';
import { AddSubjectModalComponent } from './components/add-subject-modal/add-subject-modal.component';
import { TimetableImportModalComponent } from './components/timetable-import-modal/timetable-import-modal.component';
import { NotificationService } from './services/notification.service';
import { NotesComponent } from './components/notes/notes.component';
import { InfoPageComponent } from './components/info-page/info-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SubjectListComponent, AnalyticsDashboardComponent, HelpModalComponent, AiChatComponent, StatsComponent, AddSubjectModalComponent, TimetableImportModalComponent, NotesComponent, InfoPageComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private attendanceService = inject(AttendanceService);
  notificationService = inject(NotificationService);
  todaysStats = this.attendanceService.todaysStats;

  activeView = signal<'home' | 'analytics' | 'ai-chat' | 'stats' | 'notes' | 'info'>('home');
  showHelpModal = signal(false);
  showSettingsMenu = signal(false);
  
  headerTitle = computed(() => {
    switch(this.activeView()) {
      case 'home': return 'Attendify';
      case 'analytics': return 'Analytics';
      case 'notes': return 'Subject Notes';
      case 'ai-chat': return 'AI Assistant';
      case 'stats': return 'Details';
      case 'info': return 'Information';
      default: return 'Attendify';
    }
  });

  constructor() {
    // Initialize notification service
    this.notificationService;
  }

  navigateTo(view: 'home' | 'analytics' | 'ai-chat' | 'stats' | 'notes' | 'info') {
    this.activeView.set(view);
  }
  
  resetData() {
    this.showSettingsMenu.set(false);
    if(confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
        this.attendanceService.resetAllData();
        this.activeView.set('home');
    }
  }

  toggleNotifications() {
    this.showSettingsMenu.set(false);
    this.notificationService.toggleNotifications(!this.notificationService.isEnabled());
  }

  openHelp() {
    this.showSettingsMenu.set(false);
    this.showHelpModal.set(true);
  }
}
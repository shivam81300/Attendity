
import { Injectable, inject, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';
import { AttendanceService } from './attendance.service';

const NOTIFICATIONS_ENABLED_KEY = 'notifications-enabled';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private storageService = inject(StorageService);
  private attendanceService = inject(AttendanceService);
  
  permission = signal<NotificationPermission>('default');
  isEnabled = signal<boolean>(false);
  private scheduledTimeouts: number[] = [];

  constructor() {
    if ('Notification' in window) {
      this.permission.set(Notification.permission);
      this.isEnabled.set(this.storageService.getItem<boolean>(NOTIFICATIONS_ENABLED_KEY) ?? false);

      effect(() => {
        this.storageService.setItem(NOTIFICATIONS_ENABLED_KEY, this.isEnabled());
        if (this.isEnabled()) {
          this.activateReminders();
        } else {
          this.clearScheduledReminders();
        }
      });

    } else {
      console.warn('Notifications API not supported in this browser.');
    }
  }

  toggleNotifications(enabled: boolean) {
    this.isEnabled.set(enabled);
  }

  private async activateReminders() {
    if (this.permission() === 'granted') {
      this.scheduleTodaysReminders();
    } else if (this.permission() === 'default') {
      const result = await Notification.requestPermission();
      this.permission.set(result);
      if (result === 'granted') {
        this.scheduleTodaysReminders();
      } else {
        this.isEnabled.set(false); // User denied permission
      }
    } else {
       // Permission was denied previously
       this.isEnabled.set(false);
       alert("Notification permission has been blocked. Please enable it in your browser settings.");
    }
  }

  private scheduleTodaysReminders() {
    this.clearScheduledReminders();
    console.log('Scheduling attendance reminders for today...');

    const now = new Date();
    const todaysSchedule = this.attendanceService.todaysSchedule();

    todaysSchedule.forEach(({ subject, slot }) => {
      const [hours, minutes] = slot.time.split(':').map(Number);
      const classTime = new Date();
      classTime.setHours(hours, minutes, 0, 0);

      // Schedule reminder for 15 minutes after class ends
      const reminderTime = new Date(classTime.getTime() + (15 * 60 * 1000));

      if (reminderTime > now) {
        const delay = reminderTime.getTime() - now.getTime();
        const timeoutId = window.setTimeout(() => {
          new Notification(`Attendify Reminder`, {
            body: `Did you attend ${subject.name}? Don't forget to mark your attendance!`,
            icon: '/assets/icon.png' // You might need to add an icon asset
          });
        }, delay);
        this.scheduledTimeouts.push(timeoutId);
      }
    });
  }

  private clearScheduledReminders() {
    console.log('Clearing scheduled reminders.');
    this.scheduledTimeouts.forEach(clearTimeout);
    this.scheduledTimeouts = [];
  }
}

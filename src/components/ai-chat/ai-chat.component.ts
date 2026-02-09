
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { Message } from '../../models/subject.model';
import { AttendanceService } from '../../services/attendance.service';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatComponent {
  private geminiService = inject(GeminiService);
  private attendanceService = inject(AttendanceService);

  subjects = this.attendanceService.subjects;
  selectedSubjectId = signal<string>('general');

  messages = signal<Message[]>([
    { sender: 'ai', text: 'Hello! I am your Attendify Assistant. Ask me anything about your attendance or select a subject to ask specific questions.' }
  ]);
  userInput = signal('');
  isLoading = signal(false);

  async sendMessage() {
    const prompt = this.userInput().trim();
    if (!prompt || this.isLoading()) return;

    // Add user message to chat
    this.messages.update(msgs => [...msgs, { sender: 'user', text: prompt }]);
    this.userInput.set('');
    this.isLoading.set(true);

    try {
      const aiResponse = await this.geminiService.generateContent(prompt, this.messages(), this.selectedSubjectId());
      this.messages.update(msgs => [...msgs, { sender: 'ai', text: aiResponse }]);
    } catch (error) {
       this.messages.update(msgs => [...msgs, { sender: 'ai', text: 'An error occurred. Please try again.' }]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
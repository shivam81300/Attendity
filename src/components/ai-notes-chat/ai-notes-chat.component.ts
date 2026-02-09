
import { Component, ChangeDetectionStrategy, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { Subject, Message } from '../../models/subject.model';

@Component({
  selector: 'app-ai-notes-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-notes-chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiNotesChatComponent {
  geminiService = inject(GeminiService);
  subject = input.required<Subject>();
  close = output<void>();
  
  messages = signal<Message[]>([]);
  userInput = signal('');
  isLoading = signal(false);

  ngOnInit() {
      this.messages.set([{ sender: 'ai', text: `Ask me anything about your notes for ${this.subject().name}.` }]);
  }

  async sendMessage() {
    const prompt = this.userInput().trim();
    if (!prompt || this.isLoading()) return;

    this.messages.update(msgs => [...msgs, { sender: 'user', text: prompt }]);
    this.userInput.set('');
    this.isLoading.set(true);
    
    const notesContent = (this.subject().notes || [])
        .map(note => `Note Title: ${note.title}\n\n${note.content}`)
        .join('\n\n---\n\n');

    try {
      const aiResponse = await this.geminiService.queryNotes(prompt, notesContent);
      this.messages.update(msgs => [...msgs, { sender: 'ai', text: aiResponse }]);
    } catch (error) {
       this.messages.update(msgs => [...msgs, { sender: 'ai', text: 'An error occurred. Please try again.' }]);
    } finally {
      this.isLoading.set(false);
    }
  }
}

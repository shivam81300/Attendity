import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../../services/attendance.service';
import { GeminiService } from '../../services/gemini.service';
import { Subject, Note } from '../../models/subject.model';
import { AiNotesChatComponent } from '../ai-notes-chat/ai-notes-chat.component';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, AiNotesChatComponent],
  templateUrl: './notes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesComponent {
  attendanceService = inject(AttendanceService);
  geminiService = inject(GeminiService);
  subjects = this.attendanceService.subjects;
  
  expandedSubjectId = signal<string | null>(null);
  selectedSubjectForChat = signal<Subject | null>(null);
  isLoading = signal<{ [key: string]: boolean }>({});
  error = signal<string | null>(null);

  private pdfJsLib: any = null;

  private async importWithFallback(urls: { lib: string, worker: string }[]): Promise<any> {
    for (const url of urls) {
      try {
        console.log(`Attempting to import PDF.js from ${url.lib}...`);
        const pdfjsModule = await import(url.lib);
        console.log(`PDF.js module imported successfully from ${url.lib}.`);

        const pdfjsLib = pdfjsModule.default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = url.worker;
        
        this.pdfJsLib = pdfjsLib;
        return this.pdfJsLib;
      } catch (error) {
        console.warn(`Failed to load from ${url.lib}. Trying next fallback.`, error);
      }
    }
    // If all URLs failed, throw an error.
    throw new Error('All configured sources for PDF.js failed to load.');
  }

  private async loadPdfJs(): Promise<any> {
    // Check if the library is already loaded and cached.
    if (this.pdfJsLib) {
      console.log('PDF.js library already available.');
      return this.pdfJsLib;
    }

    const cdnUrls = [
      { // Primary: jsdelivr
        lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.179/build/pdf.min.mjs',
        worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.179/build/pdf.worker.min.mjs'
      },
      { // Fallback: unpkg
        lib: 'https://unpkg.com/pdfjs-dist@4.4.179/build/pdf.min.mjs',
        worker: 'https://unpkg.com/pdfjs-dist@4.4.179/build/pdf.worker.min.mjs'
      }
    ];

    try {
      return await this.importWithFallback(cdnUrls);
    } catch (error) {
      console.error('Failed to import PDF.js library module from all sources. Check CDN or internet connection.', error);
      throw new Error('Could not load PDF library. Please check your internet connection and try again.');
    }
  }

  toggleSubject(subjectId: string) {
    this.expandedSubjectId.update(id => id === subjectId ? null : subjectId);
  }

  async onFileSelected(event: Event, subject: Subject) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = ['text/plain', 'image/png', 'image/jpeg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      this.error.set('Unsupported file type. Please upload a .txt, .pdf, .png, or .jpg file.');
      return;
    }
    
    this.error.set(null);
    this.isLoading.update(loading => ({ ...loading, [subject.id]: true }));

    try {
      let content = '';
      if (file.type === 'text/plain') {
        content = await file.text();
      } else if (file.type === 'application/pdf') {
          console.log('Processing PDF file...');
          const pdfjsLib = await this.loadPdfJs();
          
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = (err) => reject(new Error('Failed to read the file.'));
              reader.readAsArrayBuffer(file);
          });
          
          console.log('PDF file read into ArrayBuffer.');
          const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
          console.log(`PDF loaded with ${pdf.numPages} pages.`);
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n\n';
          }
          content = fullText;
          console.log('PDF text extracted successfully.');
      } else { // It's an image
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64Data = dataUrl.split(',')[1];
        content = await this.geminiService.extractTextFromImage({ mimeType: file.type, data: base64Data });
      }

      if (!content.trim()) {
          throw new Error('Could not extract any content from the file. It might be empty or in an unsupported format.');
      }
      
      const note: Omit<Note, 'id' | 'uploadDate'> = {
        title: file.name,
        fileName: file.name,
        fileType: file.type,
        content: content,
      };

      this.attendanceService.addNote(subject.id, note);

    } catch (e: any) {
      console.error('Error during file processing:', e);
      this.error.set(e.message || 'Failed to upload and process the note.');
    } finally {
      this.isLoading.update(loading => ({ ...loading, [subject.id]: false }));
      input.value = ''; // Reset file input
    }
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  deleteNote(subjectId: string, noteId: string) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.attendanceService.deleteNote(subjectId, noteId);
    }
  }

  startChat(subject: Subject) {
    this.selectedSubjectForChat.set(subject);
  }
}
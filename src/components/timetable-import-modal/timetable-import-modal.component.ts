import { Component, ChangeDetectionStrategy, output, signal, inject, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { TimetableSlot } from '../../models/subject.model';

@Component({
  selector: 'app-timetable-import-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timetable-import-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimetableImportModalComponent {
  geminiService = inject(GeminiService);
  close = output<void>();
  import = output<TimetableSlot[]>();

  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  timetableText = signal('');
  selectedFile = signal<{ name: string; type: string; data: string; previewUrl: string } | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        this.error.set('Please select an image file.');
        return;
    }
    
    this.error.set(null);
    this.timetableText.set('');

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result as string;
        this.selectedFile.set({
            name: file.name,
            type: file.type,
            data: dataUrl.split(',')[1],
            previewUrl: dataUrl
        });
    };
    reader.readAsDataURL(file);
  }

  triggerFileSelect() {
    this.fileInput()?.nativeElement.click();
  }

  clearSelection() {
    this.selectedFile.set(null);
    if(this.fileInput()) {
        this.fileInput()!.nativeElement.value = '';
    }
  }

  onTextInput() {
    this.clearSelection();
  }

  async startParsing() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      let slots: TimetableSlot[] = [];
      const file = this.selectedFile();
      const text = this.timetableText().trim();

      if (file) {
        // FIX: Corrected the argument to match the expected type '{ mimeType: string; data: string; }'.
        slots = await this.geminiService.parseTimetableImage({ mimeType: file.type, data: file.data });
      } else if (text) {
        slots = await this.geminiService.parseTimetableText(text);
      } else {
        return;
      }

      if (slots.length > 0) {
        this.import.emit(slots);
      } else {
        this.error.set('No timetable slots could be found.');
      }
    } catch (e: any) {
      this.error.set(e.message || 'An unexpected error occurred.');
    } finally {
      this.isLoading.set(false);
    }
  }
}

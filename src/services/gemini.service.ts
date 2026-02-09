
import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { AttendanceService } from './attendance.service';
import { Message, TimetableSlot } from '../models/subject.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private attendanceService = inject(AttendanceService);
  private ai: GoogleGenAI;
  private readonly timetableSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: {
            type: Type.STRING,
            enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            description: 'The day of the week.',
          },
          time: {
            type: Type.STRING,
            description: 'The time of the class in HH:mm 24-hour format.',
          },
          subjectName: {
            type: Type.STRING,
            description: 'The name of the subject or course.'
          },
          teacherName: {
            type: Type.STRING,
            description: 'The name of the teacher or professor for the class.'
          }
        },
        required: ["day", "time", "subjectName"],
      },
    };

  constructor() {
    if (!process.env.API_KEY) {
      console.error("API_KEY environment variable not set.");
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateContent(prompt: string, history: Message[], subjectId: string = 'general'): Promise<string> {
    const allSubjects = this.attendanceService.subjects();
    let systemInstruction = 'You are Attendify Assistant, a helpful and encouraging AI guide for students. Your goal is to provide clear, concise, and actionable advice regarding their attendance and study strategies based on the data provided. Keep your answers brief and to the point.';
    let context = '';

    const attendanceData = allSubjects.map(subject => ({
      name: subject.name,
      percentage: subject.total > 0 ? (subject.present / subject.total * 100).toFixed(1) : 0,
      status: subject.total > 0 && ((subject.present / subject.total * 100) < 75) ? 'Needs attention' : 'Safe'
    }));

    context += `Here is the user's current attendance data:\n${JSON.stringify(attendanceData, null, 2)}\n\n`;
    
    if (subjectId !== 'general') {
      const subject = allSubjects.find(s => s.id === subjectId);
      if (subject) {
        systemInstruction = `You are an expert tutor and study assistant for the subject: "${subject.name}". Answer the user's questions clearly and concisely. Help them understand concepts related to this subject.`;

        const notesContent = (subject.notes || [])
          .map(note => `Note Title: ${note.title}\n\n${note.content}`)
          .join('\n\n---\n\n');
        
        if (notesContent) {
          context += `The user has provided the following notes for this subject. You can use these for context, but you should also use your general knowledge about the subject to provide comprehensive answers.\n\nNotes for ${subject.name}:\n---\n${notesContent}\n---\n\n`;
        }
      }
    }
    
    const fullPrompt = `
      ${context}
      The user's current prompt is: "${prompt}"
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction: systemInstruction
        }
      });
      return response.text;
    } catch (error) {
      console.error('Error generating content from Gemini API:', error);
      return 'Sorry, I encountered an error while trying to respond. Please check your connection or API key and try again.';
    }
  }

  async parseTimetableText(text: string): Promise<TimetableSlot[]> {
    const prompt = `
      You are a timetable parsing assistant. Given the following text from a user's schedule, extract all class slots.
      For each slot, identify the subject name, the teacher/professor's name, the day of the week, and the time.
      Return the result as a JSON array of objects.
      - The 'subjectName' is the name of the course.
      - The 'teacherName' is the name of the professor. If not available, this can be omitted.
      - The 'day' should be one of 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'.
      - The 'time' should be in HH:mm 24-hour format (e.g., '14:30').
      
      Here is the text:
      "${text}"
    `;

    try {
       const response = await this.ai.models.generateContent({
         model: "gemini-2.5-flash",
         contents: prompt,
         config: {
           responseMimeType: "application/json",
           responseSchema: this.timetableSchema,
         },
      });

      const jsonStr = response.text.trim();
      const parsedSlots = JSON.parse(jsonStr);
      
      if (Array.isArray(parsedSlots)) {
        return parsedSlots as TimetableSlot[];
      }
      return [];

    } catch (error) {
      console.error('Error parsing timetable with Gemini API:', error);
      throw new Error('Could not parse the timetable. Please check the format and try again.');
    }
  }

  async parseTimetableImage(fileData: { mimeType: string; data: string }): Promise<TimetableSlot[]> {
    const prompt = `
      You are a timetable parsing assistant. Analyze the provided image of a user's schedule and extract all class slots.
      For each slot, identify the subject name, the teacher/professor's name, the day of the week, and the time.
      Return the result as a JSON array of objects.
      - The 'subjectName' is the name of the course.
      - The 'teacherName' is the name of the professor. If not available, this can be omitted.
      - The 'day' should be one of 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'.
      - The 'time' should be in HH:mm 24-hour format (e.g., '14:30').
    `;

    try {
      const imagePart = {
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data,
        },
      };

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }, imagePart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: this.timetableSchema,
        },
      });

      const jsonStr = response.text.trim();
      const parsedSlots = JSON.parse(jsonStr);

      if (Array.isArray(parsedSlots)) {
        return parsedSlots as TimetableSlot[];
      }
      return [];

    } catch (error) {
      console.error('Error parsing timetable image with Gemini API:', error);
      throw new Error('Could not parse the timetable image. Please ensure it is clear and try again.');
    }
  }

  async extractTextFromImage(fileData: { mimeType: string; data: string }): Promise<string> {
    const prompt = 'Extract all the text from this image. Present it as a single block of text.';
    try {
      const imagePart = {
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data,
        },
      };

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }, imagePart] },
      });
      return response.text;
    } catch (error) {
      console.error('Error extracting text from image with Gemini API:', error);
      throw new Error('Could not extract text from the image.');
    }
  }

  async queryNotes(question: string, notesContent: string): Promise<string> {
    const prompt = `
      You are a study assistant. Your task is to answer the user's question based *only* on the provided notes.
      If the answer cannot be found in the notes, you must clearly state that. Do not use any external knowledge.

      Here is the question:
      "${question}"

      Here are the notes:
      ---
      ${notesContent}
      ---
    `;

    try {
       const response = await this.ai.models.generateContent({
         model: "gemini-2.5-flash",
         contents: prompt,
         config: {
           systemInstruction: 'You are a helpful study assistant who answers questions strictly based on the provided context.'
         }
      });
      return response.text;
    } catch (error) {
      console.error('Error querying notes with Gemini API:', error);
      throw new Error('Could not get an answer from the AI.');
    }
  }
}
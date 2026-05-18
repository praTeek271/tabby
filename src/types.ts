import { User as FirebaseUser } from 'firebase/auth';

export interface Note {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  color: string;
  viewMode: 'text' | 'markdown';
}

export interface AppSettings {
  autoSave: boolean;
  fontSize: string;
  fontFamily: string;
  theme: string;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

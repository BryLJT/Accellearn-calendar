
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string; // In production, this will be a hashed string stored in DynamoDB
  avatarUrl?: string;
  createdAt?: string;
  type?: 'user'; // Useful for DynamoDB identification
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO Date string YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  taggedUserIds: string[];
  createdBy: string;
  color?: string; // Unified color field
  adminColor?: string; // Deprecated
  userColor?: string; // Deprecated
  recurrence?: RecurrenceType;
  recurrenceEndsOn?: string; // ISO Date YYYY-MM-DD
  exceptionDates?: string[]; // Array of ISO Date strings
  tags?: string[];
  type?: 'event'; // Useful for DynamoDB identification
}

export interface AIEventParseResult {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  taggedUserIds?: string[];
  recurrence?: RecurrenceType;
  tags?: string[];
}

import { User, CalendarEvent, UserRole } from '../types';
import { CONFIG } from './config';

/**
 * PHASE 5: AWS API GATEWAY CONNECTION
 * Connected to AWS Lambda via API Gateway
 */
// We use the URL from our central config file
const API_BASE_URL = CONFIG.API_URL;

const USERS_KEY = 'teamsync_users';
const EVENTS_KEY = 'teamsync_events';
const CURRENT_USER_KEY = 'teamsync_current_user';

// If API_BASE_URL is present, we are in Cloud Mode.
const isUsingMock = !API_BASE_URL || API_BASE_URL.length === 0;

const delay = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

const initMockData = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    const defaultUsers: User[] = [
      { id: 'admin-1', username: 'admin', name: 'System Admin', role: UserRole.ADMIN, password: 'admin', avatarUrl: 'https://picsum.photos/seed/admin/200' },
      { id: 'user-1', username: 'user', name: 'Jane Doe', role: UserRole.USER, password: 'user', avatarUrl: 'https://picsum.photos/seed/jane/200' }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem(EVENTS_KEY)) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify([]));
  }
};

if (isUsingMock) {
  initMockData();
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Normalize Base URL
  const baseUrl = API_BASE_URL.replace(/\/$/, '').trim();
  
  // SINGLE ENTRY POINT STRATEGY:
  // Instead of appending paths (e.g. /login), we pass the route as a query parameter.
  // This ensures we always hit the 'ANY /' route in API Gateway, bypassing 404 errors for unconfigured proxy routes.
  const url = `${baseUrl}?route=${encodeURIComponent(endpoint)}`;
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only add Content-Type for requests that have a body
  if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors', // Explicitly request CORS
      headers,
    });

    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorMessage = response.statusText;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || JSON.stringify(errorJson);
      } catch (e) {
        const textText = await response.text();
        if (textText) errorMessage = textText;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    console.error(`Fetch Failed for ${url}:`, error);
    
    // Provide a more helpful error message for "Failed to fetch" (CORS/Network)
    if (error.message === 'Failed to fetch') {
      throw new Error("Network Error: Could not connect to AWS. Check API Gateway URL and CORS configuration.");
    }
    
    throw error;
  }
}

export const storageService = {
  getUsers: async (): Promise<User[]> => {
    if (!isUsingMock) return apiFetch('/users');
    await delay();
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: async (user: User): Promise<void> => {
    if (!isUsingMock) {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(user)
      });
      return;
    }
    await delay();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (!isUsingMock) {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      return;
    }
    await delay();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    localStorage.setItem(USERS_KEY, JSON.stringify(users.filter((u: User) => u.id !== userId)));
  },

  getEvents: async (): Promise<CalendarEvent[]> => {
    if (!isUsingMock) return apiFetch('/events');
    await delay();
    const data = localStorage.getItem(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveEvent: async (event: CalendarEvent): Promise<void> => {
    if (!isUsingMock) {
      await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify(event)
      });
      return;
    }
    await delay();
    const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    const index = events.findIndex((e: CalendarEvent) => e.id === event.id);
    if (index >= 0) {
      events[index] = event;
    } else {
      events.push(event);
    }
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    if (!isUsingMock) {
      await apiFetch(`/events/${eventId}`, { method: 'DELETE' });
      return;
    }
    await delay();
    const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.filter((e: CalendarEvent) => e.id !== eventId)));
  },

  login: async (username: string, password: string): Promise<User | null> => {
    if (!isUsingMock) {
      // Propagate errors up to the UI instead of swallowing them
      const user = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
    await delay(400);
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: User) => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
    throw new Error("Invalid credentials");
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem(CURRENT_USER_KEY);
    if (!isUsingMock) {
      try {
        await apiFetch('/logout', { method: 'POST' });
      } catch (e) {}
    }
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  }
};
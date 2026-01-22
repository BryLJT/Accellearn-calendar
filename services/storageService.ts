import { User, CalendarEvent, UserRole } from '../types';

const USERS_KEY = 'teamsync_users';
const EVENTS_KEY = 'teamsync_events';
const CURRENT_USER_KEY = 'teamsync_current_user';

// Utility to simulate network latency
const delay = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

const initData = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    const defaultUsers: User[] = [
      { id: 'admin-1', username: 'admin', name: 'System Admin', role: UserRole.ADMIN, password: 'admin', avatarUrl: 'https://picsum.photos/seed/admin/200' },
      { id: 'user-1', username: 'user', name: 'Jane Doe', role: UserRole.USER, password: 'user', avatarUrl: 'https://picsum.photos/seed/jane/200' },
      { id: 'user-2', username: 'user2', name: 'Michael Chen', role: UserRole.USER, password: 'user2', avatarUrl: 'https://picsum.photos/seed/michael/200' }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem(EVENTS_KEY)) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify([]));
  }
};

initData();

export const storageService = {
  getUsers: async (): Promise<User[]> => {
    await delay();
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: async (user: User): Promise<void> => {
    await delay();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // If the updated user is the current logged in user, update their session too
    const currentUser = storageService.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    await delay();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    localStorage.setItem(USERS_KEY, JSON.stringify(users.filter((u: User) => u.id !== userId)));
  },

  getEvents: async (): Promise<CalendarEvent[]> => {
    await delay();
    const data = localStorage.getItem(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveEvent: async (event: CalendarEvent): Promise<void> => {
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
    await delay();
    const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.filter((e: CalendarEvent) => e.id !== eventId)));
  },

  login: async (username: string, password: string): Promise<User | null> => {
    await delay(400);
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: User) => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  }
};
import { User, CalendarEvent, UserRole } from '../types';

const USERS_KEY = 'teamsync_users';
const EVENTS_KEY = 'teamsync_events';
const CURRENT_USER_KEY = 'teamsync_current_user';

// Initialize default data if empty
const initData = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    const defaultAdmin: User = {
      id: 'admin-1',
      username: 'admin',
      name: 'System Admin',
      role: UserRole.ADMIN,
      password: 'admin', // Simple mock password
      avatarUrl: 'https://picsum.photos/seed/admin/200'
    };
    const defaultUser: User = {
      id: 'user-1',
      username: 'user',
      name: 'Jane Doe',
      role: UserRole.USER,
      password: 'user',
      avatarUrl: 'https://picsum.photos/seed/jane/200'
    };
    const user2: User = {
      id: 'user-2',
      username: 'user2',
      name: 'Michael Chen',
      role: UserRole.USER,
      password: 'user2',
      avatarUrl: 'https://picsum.photos/seed/michael/200'
    };
    const user3: User = {
      id: 'user-3',
      username: 'user3',
      name: 'Sarah Connor',
      role: UserRole.USER,
      password: 'user3',
      avatarUrl: 'https://picsum.photos/seed/sarah/200'
    };
    const user4: User = {
      id: 'user-4',
      username: 'user4',
      name: 'David Smith',
      role: UserRole.USER,
      password: 'user4',
      avatarUrl: 'https://picsum.photos/seed/david/200'
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin, defaultUser, user2, user3, user4]));
  }

  if (!localStorage.getItem(EVENTS_KEY)) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify([]));
  }
};

initData();

export const storageService = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: User): void => {
    const users = storageService.getUsers();
    // Update or add
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: (userId: string): void => {
    const users = storageService.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  getEvents: (): CalendarEvent[] => {
    const data = localStorage.getItem(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveEvent: (event: CalendarEvent): void => {
    const events = storageService.getEvents();
    const index = events.findIndex(e => e.id === event.id);
    if (index >= 0) {
      events[index] = event;
    } else {
      events.push(event);
    }
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  },

  deleteEvent: (eventId: string): void => {
    const events = storageService.getEvents().filter(e => e.id !== eventId);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  },

  // Auth Mocks
  login: (username: string, password: string): User | null => {
    const users = storageService.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: (): void => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  }
};
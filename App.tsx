import React, { useState, useEffect } from 'react';
import { User, UserRole, CalendarEvent } from './types';
import { storageService } from './services/storageService';
import { EventCalendar } from './components/EventCalendar';
import { UserManagement } from './components/UserManagement';
import { Button } from './components/Button';
import { LayoutDashboard, Users, LogOut, Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'users'>('calendar');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    // Check for existing session
    const currentUser = storageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      refreshData();
    }
  }, []);

  const refreshData = () => {
    setAllUsers(storageService.getUsers());
    setEvents(storageService.getEvents());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = storageService.login(username, password);
    if (loggedInUser) {
      setUser(loggedInUser);
      setLoginError('');
      refreshData();
    } else {
      setLoginError('Invalid credentials. Try admin/admin or user/user');
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setUsername('');
    setPassword('');
  };

  const handleAddUser = (newUser: User) => {
    storageService.saveUser(newUser);
    refreshData();
  };

  const handleDeleteUser = (id: string) => {
    storageService.deleteUser(id);
    refreshData();
  };

  const handleAddEvent = (event: CalendarEvent) => {
    storageService.saveEvent(event);
    refreshData();
  };

  const handleDeleteEvent = (id: string) => {
    storageService.deleteEvent(id);
    refreshData();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
              <CalendarIcon className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">TeamSync Calendar</h1>
            <p className="text-indigo-100 text-sm">Sign in to manage your schedule</p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {loginError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {loginError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  placeholder="admin"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  placeholder="admin"
                />
              </div>

              <Button type="submit" className="w-full justify-center py-2.5">
                Sign In
              </Button>
            </form>
            <div className="mt-6 text-center text-xs text-slate-400">
              <p>Demo Credentials:</p>
              <p>Admin: admin / admin</p>
              <p>User: user / user</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="bg-slate-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <CalendarIcon size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">TeamSync</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Calendar</span>
          </button>

          {user.role === UserRole.ADMIN && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Users size={20} />
              <span className="font-medium">Team Members</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full bg-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {activeTab === 'calendar' && (
            <EventCalendar 
              events={events}
              currentUser={user}
              users={allUsers}
              onAddEvent={handleAddEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          )}
          {activeTab === 'users' && user.role === UserRole.ADMIN && (
            <UserManagement 
              users={allUsers}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
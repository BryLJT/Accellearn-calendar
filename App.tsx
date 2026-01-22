import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, CalendarEvent } from './types';
import { storageService } from './services/storageService';
import { EventCalendar } from './components/EventCalendar';
import { UserManagement } from './components/UserManagement';
import { Button } from './components/Button';
import { LayoutDashboard, Users, LogOut, Calendar as CalendarIcon, Loader2, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'users'>('calendar');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const refreshData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsActionLoading(true);
    const [fetchedUsers, fetchedEvents] = await Promise.all([
      storageService.getUsers(),
      storageService.getEvents()
    ]);
    setAllUsers(fetchedUsers);
    setEvents(fetchedEvents);
    setLastSync(new Date());
    if (showLoading) setIsActionLoading(false);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const currentUser = storageService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        await refreshData();
      }
      setIsInitialLoad(false);
    };
    checkSession();
  }, [refreshData]);

  // "Live Update" Simulation: Poll every 10 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshData();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, refreshData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const loggedInUser = await storageService.login(username, password);
      if (loggedInUser) {
        setUser(loggedInUser);
        setLoginError('');
        await refreshData();
      } else {
        setLoginError('Invalid credentials. Use admin/admin or user/user');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await storageService.logout();
    setUser(null);
    setUsername('');
    setPassword('');
  };

  const handleSaveUser = async (userToSave: User) => {
    setIsActionLoading(true);
    await storageService.saveUser(userToSave);
    await refreshData();
    setIsActionLoading(false);
  };

  const handleDeleteUser = async (id: string) => {
    setIsActionLoading(true);
    await storageService.deleteUser(id);
    await refreshData();
    setIsActionLoading(false);
  };

  const handleAddEvent = async (event: CalendarEvent) => {
    setIsActionLoading(true);
    await storageService.saveEvent(event);
    await refreshData();
    setIsActionLoading(false);
  };

  const handleDeleteEvent = async (id: string) => {
    setIsActionLoading(true);
    await storageService.deleteEvent(id);
    await refreshData();
    setIsActionLoading(false);
  };

  if (isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
              <CalendarIcon className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">TeamSync Calendar</h1>
            <p className="text-indigo-100 text-sm">Self-hosted team collaboration</p>
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
                  disabled={isActionLoading}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  disabled={isActionLoading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>

              <Button type="submit" className="w-full justify-center py-2.5" isLoading={isActionLoading}>
                Sign In
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {isActionLoading && (
        <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-[9999] flex items-center justify-center">
           <div className="bg-white p-4 rounded-full shadow-lg">
             <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
           </div>
        </div>
      )}

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
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center space-x-3 min-w-0">
              <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full bg-slate-700" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <div className="flex items-center text-[10px] text-slate-500">
                  <RefreshCw size={10} className="mr-1 animate-pulse" />
                  Synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
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
              onAddUser={handleSaveUser}
              onUpdateUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
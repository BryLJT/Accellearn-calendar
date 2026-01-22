import React, { useState, useMemo } from 'react';
import { CalendarEvent, User, UserRole, RecurrenceType } from '../types';
import { ChevronLeft, ChevronRight, Clock, Plus, Wand2, Trash2, Users, Calendar as CalendarIcon, Palette, Repeat, Tag, Filter, X, Download, Share2, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { parseEventWithAI } from '../services/geminiService';
import { generateICS } from '../services/icsService';

interface EventCalendarProps {
  events: CalendarEvent[];
  currentUser: User;
  users: User[];
  onAddEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

// Define available colors
const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', class: 'bg-indigo-100 border-indigo-200 text-indigo-800 hover:bg-indigo-200' },
  { id: 'blue', label: 'Blue', class: 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200' },
  { id: 'green', label: 'Green', class: 'bg-green-100 border-green-200 text-green-800 hover:bg-green-200' },
  { id: 'red', label: 'Red', class: 'bg-red-100 border-red-200 text-red-800 hover:bg-red-200' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200' },
  { id: 'purple', label: 'Purple', class: 'bg-purple-100 border-purple-200 text-purple-800 hover:bg-purple-200' },
  { id: 'pink', label: 'Pink', class: 'bg-pink-100 border-pink-200 text-pink-800 hover:bg-pink-200' },
  { id: 'slate', label: 'Slate', class: 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200' },
];

export const EventCalendar: React.FC<EventCalendarProps> = ({ 
  events, 
  currentUser, 
  users, 
  onAddEvent,
  onDeleteEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Filtering State
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterUserIds, setFilterUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Form State
  const [tagInput, setTagInput] = useState('');
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    taggedUserIds: [],
    adminColor: 'indigo',
    userColor: 'indigo',
    recurrence: 'none',
    tags: []
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Get all unique tags from all events for the filter dropdown
  const allAvailableTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach(e => e.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [events]);

  // Logic: Generate instances of recurring events for the current view
  const processedEvents = useMemo(() => {
    let result: CalendarEvent[] = [];
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    events.forEach(event => {
      // 1. If not recurring, just check if it falls in this month
      if (!event.recurrence || event.recurrence === 'none') {
        const eventDate = new Date(event.date);
        // Simple string comparison for standard events to ensure they show up
        if (event.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)) {
          result.push(event);
        }
        return;
      }

      // 2. Handle Recurrence
      const eventStartDate = new Date(event.date);
      // Don't process if event starts after this month
      if (eventStartDate > monthEnd) return;

      // Iterate through days of the current month
      for (let day = 1; day <= days; day++) {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        
        // Skip if checkDate is before the event actually starts
        if (checkDate < eventStartDate) continue;

        let isMatch = false;

        if (event.recurrence === 'daily') {
          isMatch = true;
        } else if (event.recurrence === 'weekly') {
          // Check if same day of week (0-6)
          if (checkDate.getDay() === eventStartDate.getDay()) {
            isMatch = true;
          }
        } else if (event.recurrence === 'monthly') {
          // Check if same day of month
          if (checkDate.getDate() === eventStartDate.getDate()) {
            isMatch = true;
          }
        }

        if (isMatch) {
          // Clone event with new date
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          result.push({
            ...event,
            date: dateStr,
            id: `${event.id}_${dateStr}` // temporary ID for display
          });
        }
      }
    });

    return result;
  }, [events, currentDate, days]);

  // Filtering Logic
  const filteredEvents = useMemo(() => {
    return processedEvents.filter(e => {
      // 1. Role Security Check
      if (currentUser.role !== UserRole.ADMIN) {
        if (!e.taggedUserIds.includes(currentUser.id)) return false;
      }

      // 2. Custom Tag Filter
      if (filterTags.length > 0) {
        const hasTag = e.tags?.some(tag => filterTags.includes(tag));
        if (!hasTag) return false;
      }

      // 3. User Filter
      if (filterUserIds.length > 0) {
        const hasUser = e.taggedUserIds.some(uid => filterUserIds.includes(uid));
        if (!hasUser) return false;
      }

      return true;
    });
  }, [processedEvents, currentUser, filterTags, filterUserIds]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    if (currentUser.role !== UserRole.ADMIN) return;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setNewEvent(prev => ({ ...prev, date: dateStr }));
    setIsAddModalOpen(true);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    const result = await parseEventWithAI(aiPrompt, users);
    setIsAiLoading(false);
    
    if (result) {
      setNewEvent(prev => ({
        ...prev,
        title: result.title || prev.title,
        date: result.date || prev.date,
        startTime: result.startTime || prev.startTime,
        endTime: result.endTime || prev.endTime,
        description: result.description || prev.description,
        taggedUserIds: result.taggedUserIds || prev.taggedUserIds,
        recurrence: result.recurrence || prev.recurrence,
        tags: result.tags || prev.tags
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) return;

    onAddEvent({
      id: crypto.randomUUID(),
      title: newEvent.title,
      description: newEvent.description || '',
      date: newEvent.date,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      taggedUserIds: newEvent.taggedUserIds || [],
      createdBy: currentUser.id,
      adminColor: newEvent.adminColor || 'indigo',
      userColor: newEvent.userColor || 'indigo',
      recurrence: newEvent.recurrence || 'none',
      tags: newEvent.tags || []
    });
    setIsAddModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setAiPrompt('');
    setTagInput('');
    setNewEvent({
      title: '',
      description: '',
      startTime: '09:00',
      endTime: '10:00',
      taggedUserIds: [],
      adminColor: 'indigo',
      userColor: 'indigo',
      recurrence: 'none',
      tags: []
    });
  }

  const toggleUserTag = (userId: string) => {
    const currentTags = newEvent.taggedUserIds || [];
    if (currentTags.includes(userId)) {
      setNewEvent({ ...newEvent, taggedUserIds: currentTags.filter(id => id !== userId) });
    } else {
      setNewEvent({ ...newEvent, taggedUserIds: [...currentTags, userId] });
    }
  };

  const addCustomTag = () => {
    if (!tagInput.trim()) return;
    const currentTags = newEvent.tags || [];
    if (!currentTags.includes(tagInput.trim())) {
      setNewEvent({ ...newEvent, tags: [...currentTags, tagInput.trim()] });
    }
    setTagInput('');
  };

  const removeCustomTag = (tagToRemove: string) => {
    setNewEvent({ 
      ...newEvent, 
      tags: (newEvent.tags || []).filter(t => t !== tagToRemove) 
    });
  };

  const handleDeleteCurrentEvent = () => {
    if (selectedEvent) {
      // If it's a recurring instance (has _date suffix), we need to find the real ID
      const realId = selectedEvent.id.split('_')[0];
      onDeleteEvent(realId);
      setSelectedEvent(null);
    }
  };

  const handleExportICS = () => {
    // 1. Filter raw events based on permissions
    const exportableEvents = events.filter(e => {
      // Admin gets everything
      if (currentUser.role === UserRole.ADMIN) return true;
      // Users get events they are tagged in
      return e.taggedUserIds.includes(currentUser.id);
    });

    // 2. Generate ICS content
    const icsContent = generateICS(exportableEvents);

    // 3. Create blob and download
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'teamsync-calendar.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    // Simulating a subscription link
    const dummyUrl = `${window.location.origin}/feed/calendar/${currentUser.id}.ics`;
    navigator.clipboard.writeText(dummyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getEventStyle = (event: CalendarEvent) => {
    const colorKey = currentUser.role === UserRole.ADMIN 
      ? (event.adminColor || 'indigo') 
      : (event.userColor || 'indigo');
    
    const colorOption = COLOR_OPTIONS.find(c => c.id === colorKey) || COLOR_OPTIONS[0];
    return colorOption.class;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const ColorPicker = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`w-6 h-6 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-transform hover:scale-110 ${
              value === option.id ? 'border-slate-600 scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: `var(--color-${option.id}-400)` }}
            title={option.label}
          >
            <div className={`w-full h-full rounded-full ${option.class.split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')}`}></div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <p className="text-slate-500">
              {currentUser.role === UserRole.ADMIN ? 'Manage team schedule' : 'Your upcoming events'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>
              <Share2 size={16} className="mr-2 text-slate-500" />
              Export
            </Button>
            <div className="h-6 w-px bg-slate-300 mx-1 hidden md:block"></div>
            <Button variant="secondary" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <Filter size={16} className={`mr-2 ${isFilterOpen ? 'text-indigo-600' : 'text-slate-500'}`} />
              Filters
              {(filterTags.length > 0 || filterUserIds.length > 0) && (
                <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                  {filterTags.length + filterUserIds.length}
                </span>
              )}
            </Button>
            <Button variant="secondary" onClick={handlePrevMonth}>
              <ChevronLeft size={20} />
            </Button>
            <Button variant="secondary" onClick={handleNextMonth}>
              <ChevronRight size={20} />
            </Button>
            {currentUser.role === UserRole.ADMIN && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus size={16} className="mr-2" />
                Add Event
              </Button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        {isFilterOpen && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Filter by User */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by User</label>
                  <div className="flex flex-wrap gap-2">
                    {users.map(u => {
                      const isActive = filterUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => setFilterUserIds(prev => isActive ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            isActive 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <img src={u.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                          <span>{u.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter by Tag */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter by Tag</label>
                  <div className="flex flex-wrap gap-2">
                    {allAvailableTags.map(tag => {
                      const isActive = filterTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => setFilterTags(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag])}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            isActive 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Tag size={12} />
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                    {allAvailableTags.length === 0 && (
                      <span className="text-sm text-slate-400 italic">No tags available</span>
                    )}
                  </div>
                </div>
             </div>
             {(filterUserIds.length > 0 || filterTags.length > 0) && (
               <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                 <button 
                  onClick={() => { setFilterUserIds([]); setFilterTags([]); }}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                 >
                   Clear All Filters
                 </button>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-white min-h-[120px]" />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
            
            return (
              <div 
                key={day} 
                className={`bg-white min-h-[120px] p-2 transition-colors hover:bg-slate-50 ${currentUser.role === UserRole.ADMIN ? 'cursor-pointer' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <div className={`flex justify-center items-center w-7 h-7 rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      className={`group relative px-2 py-1 border rounded text-xs truncate cursor-pointer transition-colors ${getEventStyle(event)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center min-w-0">
                            {event.recurrence && event.recurrence !== 'none' && (
                              <Repeat size={10} className="mr-1 flex-shrink-0 opacity-70" />
                            )}
                            <span className="font-semibold mr-1">{event.startTime}</span>
                            <span className="truncate">{event.title}</span>
                          </span>
                        </div>
                        {event.tags && event.tags.length > 0 && (
                          <div className="flex gap-1 overflow-hidden">
                            {event.tags.map(tag => (
                              <span key={tag} className="inline-block px-1 rounded bg-white/40 text-[9px]">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Export Calendar"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <h4 className="font-medium text-indigo-900 mb-2 flex items-center">
              <Download size={18} className="mr-2" />
              Download .ICS File
            </h4>
            <p className="text-sm text-indigo-700 mb-4">
              Download a snapshot of your current calendar. You can import this file into Google Calendar, Outlook, or Apple Calendar.
            </p>
            <Button onClick={handleExportICS} className="w-full">
              Download File
            </Button>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-2 flex items-center">
              <LinkIcon size={18} className="mr-2" />
              Subscription Link (Live Updates)
            </h4>
            <p className="text-sm text-slate-600 mb-3">
              To subscribe for live updates, your calendar client needs a persistent URL.
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-white border border-slate-300 rounded text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                {`${window.location.origin}/feed/calendar/${currentUser.id}.ics`}
              </code>
              <Button variant="secondary" onClick={handleCopyLink} className="shrink-0">
                {copiedLink ? <Check size={16} className="text-green-600" /> : <span className="text-xs">Copy</span>}
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 italic">
              * Note: In this demo environment, this URL is a placeholder. A real backend is required to serve the live ICS feed.
            </p>
          </div>
        </div>
      </Modal>

      {/* View Event Details Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Event Details"
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {selectedEvent.title}
                  {selectedEvent.recurrence && selectedEvent.recurrence !== 'none' && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-normal border border-slate-200 flex items-center">
                      <Repeat size={12} className="mr-1" />
                      {selectedEvent.recurrence}
                    </span>
                  )}
                </h3>
                <div className="flex items-center text-slate-500 mt-2 text-sm">
                  <CalendarIcon size={16} className="mr-2" />
                  {selectedEvent.date}
                </div>
                <div className="flex items-center text-slate-500 mt-1 text-sm">
                  <Clock size={16} className="mr-2" />
                  {selectedEvent.startTime} - {selectedEvent.endTime}
                </div>
              </div>
            </div>

            {selectedEvent.description && (
              <div className="bg-slate-50 p-4 rounded-lg text-slate-700 text-sm border border-slate-100">
                {selectedEvent.description}
              </div>
            )}

            {selectedEvent.tags && selectedEvent.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center">
                  <Tag size={16} className="mr-2" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-100">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                <Users size={16} className="mr-2" />
                Tagged Team Members
              </h4>
              <div className="flex flex-wrap gap-2">
                {users.filter(u => selectedEvent.taggedUserIds.includes(u.id)).map(u => (
                  <div key={u.id} className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 pl-1 pr-3 py-1 rounded-full">
                    <img src={u.avatarUrl} alt={u.name} className="w-6 h-6 rounded-full" />
                    <span className="text-sm font-medium text-indigo-900">{u.name}</span>
                  </div>
                ))}
                {selectedEvent.taggedUserIds.length === 0 && (
                  <p className="text-sm text-slate-400 italic pl-1">No members tagged</p>
                )}
              </div>
            </div>

            {currentUser.role === UserRole.ADMIN && (
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  {selectedEvent.recurrence && selectedEvent.recurrence !== 'none' 
                    ? "Deleting this instance removes the entire series." 
                    : ""}
                </p>
                <Button variant="danger" onClick={handleDeleteCurrentEvent}>
                  <Trash2 size={16} className="mr-2" />
                  Delete Event
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Event Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Schedule Event"
      >
        <div className="space-y-6">
          {/* AI Quick Add Section */}
          <div className="bg-gradient-to-r from-indigo-50 to-slate-50 p-4 rounded-xl border border-indigo-100">
            <label className="flex items-center text-sm font-semibold text-indigo-700 mb-2">
              <Wand2 size={16} className="mr-2" />
              AI Quick Fill
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Weekly Standup #urgent with Jane every Monday at 10am"
                className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
              />
              <Button 
                variant="primary" 
                onClick={handleAiGenerate}
                isLoading={isAiLoading}
                disabled={!aiPrompt}
                className="shrink-0"
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              AI detects: dates, times, <span className="text-indigo-600 font-medium">tags (#)</span>, <span className="text-indigo-600 font-medium">recurrence</span>, and users.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
              <input
                required
                type="text"
                value={newEvent.title}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  required
                  type="date"
                  value={newEvent.date}
                  onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recurrence</label>
                <select
                  value={newEvent.recurrence || 'none'}
                  onChange={e => setNewEvent({...newEvent, recurrence: e.target.value as RecurrenceType})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                  <input
                    required
                    type="time"
                    value={newEvent.startTime}
                    onChange={e => setNewEvent({...newEvent, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">End</label>
                  <input
                    required
                    type="time"
                    value={newEvent.endTime}
                    onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  />
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={newEvent.description}
                onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custom Tags</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); }}}
                  placeholder="Type tag and press Enter"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
                />
                <Button type="button" variant="secondary" onClick={addCustomTag}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                 {newEvent.tags?.map(tag => (
                   <span key={tag} className="flex items-center bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs border border-emerald-100">
                     #{tag}
                     <button type="button" onClick={() => removeCustomTag(tag)} className="ml-1 hover:text-emerald-900"><X size={12} /></button>
                   </span>
                 ))}
              </div>
            </div>

            {/* Color Coding Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center mb-3">
                <Palette size={16} className="text-slate-500 mr-2" />
                <span className="text-sm font-medium text-slate-700">Color Coding</span>
              </div>
              <div className="space-y-4">
                <ColorPicker 
                  label="Admin View Color (You)" 
                  value={newEvent.adminColor || 'indigo'} 
                  onChange={(val) => setNewEvent({...newEvent, adminColor: val})}
                />
                <ColorPicker 
                  label="User View Color (Team)" 
                  value={newEvent.userColor || 'indigo'} 
                  onChange={(val) => setNewEvent({...newEvent, userColor: val})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tag Team Members</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {users.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUserTag(user.id)}
                    className={`
                      inline-flex items-center pl-1 pr-2.5 py-1 rounded-full text-xs font-medium transition-all border
                      ${(newEvent.taggedUserIds || []).includes(user.id)
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                    `}
                  >
                    <img src={user.avatarUrl} className="w-5 h-5 rounded-full mr-2 bg-white/20" alt="" />
                    {user.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" className="mr-2" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Event
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
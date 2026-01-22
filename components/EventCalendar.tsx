import React, { useState, useMemo } from 'react';
import { CalendarEvent, User, UserRole, RecurrenceType } from '../types';
import { ChevronLeft, ChevronRight, Clock, Plus, Wand2, Trash2, Users, Calendar as CalendarIcon, Palette, Repeat, Tag, Filter, X, Download, Share2, Link as LinkIcon, Check, Info, Pencil, AlignLeft } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { parseEventWithAI } from '../services/geminiService';
import { generateICS } from '../services/icsService';

interface EventCalendarProps {
  events: CalendarEvent[];
  currentUser: User;
  users: User[];
  onAddEvent: (event: CalendarEvent) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

const COLOR_OPTIONS = [
  { id: 'purple', label: 'Purple', class: 'bg-purple-100 border-purple-200 text-purple-800 hover:bg-purple-200' },
  { id: 'blue', label: 'Blue', class: 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200' },
  { id: 'green', label: 'Green', class: 'bg-green-100 border-green-200 text-green-800 hover:bg-green-200' },
  { id: 'red', label: 'Red', class: 'bg-red-100 border-red-200 text-red-800 hover:bg-red-200' },
  { id: 'amber', label: 'Amber', class: 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200' },
  { id: 'pink', label: 'Pink', class: 'bg-pink-100 border-pink-200 text-pink-800 hover:bg-pink-200' },
  { id: 'slate', label: 'Slate', class: 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200' },
];

export const EventCalendar: React.FC<EventCalendarProps> = ({ 
  events, 
  currentUser, 
  users, 
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterUserIds, setFilterUserIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Helper to reset form state
  const getEmptyEvent = (dateStr?: string): Partial<CalendarEvent> => ({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    taggedUserIds: [],
    adminColor: 'purple',
    userColor: 'purple',
    recurrence: 'none',
    tags: [],
    date: dateStr || new Date().toISOString().split('T')[0]
  });

  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>(getEmptyEvent());

  const { days, firstDay } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    return { days: daysInMonth, firstDay: firstDayOfMonth };
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const allAvailableTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach(e => e.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [events]);

  const processedEvents = useMemo(() => {
    let result: CalendarEvent[] = [];
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    events.forEach(event => {
      if (!event.recurrence || event.recurrence === 'none') {
        if (event.date.startsWith(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)) {
          result.push(event);
        }
        return;
      }

      const eventStartDate = new Date(event.date);
      if (eventStartDate > monthEnd) return;

      for (let day = 1; day <= days; day++) {
        const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (checkDate < eventStartDate) continue;

        let isMatch = false;
        if (event.recurrence === 'daily') isMatch = true;
        else if (event.recurrence === 'weekly' && checkDate.getDay() === eventStartDate.getDay()) isMatch = true;
        else if (event.recurrence === 'monthly' && checkDate.getDate() === eventStartDate.getDate()) isMatch = true;

        if (isMatch) {
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          result.push({ ...event, date: dateStr, id: `${event.id}_${dateStr}` });
        }
      }
    });
    return result;
  }, [events, currentDate, days]);

  const filteredEvents = useMemo(() => {
    return processedEvents.filter(e => {
      if (currentUser.role !== UserRole.ADMIN && !e.taggedUserIds.includes(currentUser.id)) return false;
      if (filterTags.length > 0 && !e.tags?.some(tag => filterTags.includes(tag))) return false;
      if (filterUserIds.length > 0 && !e.taggedUserIds.some(uid => filterUserIds.includes(uid))) return false;
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
    setNewEvent(getEmptyEvent(dateStr));
    setIsAddModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setNewEvent(getEmptyEvent());
    setIsAddModalOpen(true);
  };

  const handleEditEvent = () => {
    if (!selectedEvent) return;
    // Extract original ID in case it's a recurrence instance
    const baseId = selectedEvent.id.split('_')[0];
    const originalEvent = events.find(e => e.id === baseId);
    
    if (originalEvent) {
      setNewEvent({ ...originalEvent });
      setSelectedEvent(null);
      setIsAddModalOpen(true);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    const result = await parseEventWithAI(aiPrompt, users);
    setIsAiLoading(false);
    if (result) setNewEvent(prev => ({ ...prev, ...result }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) return;

    const eventToSave: CalendarEvent = {
      id: newEvent.id || crypto.randomUUID(),
      title: newEvent.title,
      description: newEvent.description || '',
      date: newEvent.date!,
      startTime: newEvent.startTime!,
      endTime: newEvent.endTime!,
      taggedUserIds: newEvent.taggedUserIds || [],
      createdBy: newEvent.createdBy || currentUser.id,
      adminColor: newEvent.adminColor || 'purple',
      userColor: newEvent.userColor || 'purple',
      recurrence: newEvent.recurrence || 'none',
      tags: newEvent.tags || []
    };

    if (newEvent.id) {
      onUpdateEvent(eventToSave);
    } else {
      onAddEvent(eventToSave);
    }

    setIsAddModalOpen(false);
    setAiPrompt('');
    setNewEvent(getEmptyEvent());
  };

  const handleExportICS = () => {
    const exportableEvents = events.filter(e => currentUser.role === UserRole.ADMIN || e.taggedUserIds.includes(currentUser.id));
    const icsContent = generateICS(exportableEvents);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `accellearn-${currentUser.username}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    const dummyUrl = `${window.location.origin}/api/v1/calendar/${currentUser.id}/feed.ics`;
    navigator.clipboard.writeText(dummyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getEventStyle = (event: CalendarEvent) => {
    const colorKey = currentUser.role === UserRole.ADMIN ? (event.adminColor || 'purple') : (event.userColor || 'purple');
    return (COLOR_OPTIONS.find(c => c.id === colorKey) || COLOR_OPTIONS[0]).class;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <p className="text-slate-500">{currentUser.role === UserRole.ADMIN ? 'Manage team schedule' : 'Your personal dashboard'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setIsShareModalOpen(true)}>
              <Share2 size={16} className="mr-2 text-slate-500" />
              Sync Cal
            </Button>
            <div className="h-6 w-px bg-slate-300 mx-1 hidden md:block"></div>
            <Button variant="secondary" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <Filter size={16} className={`mr-2 ${isFilterOpen ? 'text-purple-600' : 'text-slate-500'}`} />
              Filters
              {(filterTags.length + filterUserIds.length > 0) && (
                <span className="ml-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{filterTags.length + filterUserIds.length}</span>
              )}
            </Button>
            <Button variant="secondary" onClick={handlePrevMonth}><ChevronLeft size={20} /></Button>
            <Button variant="secondary" onClick={handleNextMonth}><ChevronRight size={20} /></Button>
            {currentUser.role === UserRole.ADMIN && (
              <Button onClick={handleOpenAddModal}><Plus size={16} className="mr-2" />Add Event</Button>
            )}
          </div>
        </div>

        {isFilterOpen && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Filter Users</label>
                  <div className="flex flex-wrap gap-2">
                    {users.map(u => (
                      <button key={u.id} onClick={() => setFilterUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${filterUserIds.includes(u.id) ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <img src={u.avatarUrl} className="w-4 h-4 rounded-full" alt="" /><span>{u.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Filter Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allAvailableTags.map(tag => (
                      <button key={tag} onClick={() => setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm border transition-all ${filterTags.includes(tag) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <Tag size={12} className="mr-1" /><span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="bg-white min-h-[120px]" />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
            return (
              <div key={day} className={`bg-white min-h-[120px] p-2 transition-colors hover:bg-slate-50 ${currentUser.role === UserRole.ADMIN ? 'cursor-pointer' : ''}`} onClick={() => handleDayClick(day)}>
                <div className={`flex justify-center items-center w-7 h-7 rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-purple-600 text-white' : 'text-slate-700'}`}>{day}</div>
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div key={event.id} className={`px-2 py-1 border rounded text-xs truncate cursor-pointer transition-all hover:brightness-95 ${getEventStyle(event)}`} onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}>
                      <span className="font-semibold mr-1">{event.startTime}</span>{event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Calendar Synchronization">
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <h4 className="font-bold text-purple-900 mb-2 flex items-center"><Download size={18} className="mr-2" />One-Time Export (.ics)</h4>
            <p className="text-sm text-purple-700 mb-4">Download a file to manually import your events into Google Calendar or Outlook.</p>
            <Button onClick={handleExportICS} className="w-full">Download ICS File</Button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center"><LinkIcon size={18} className="mr-2" />Live Calendar Feed (Link)</h4>
            <p className="text-sm text-slate-600 mb-3">Copy this URL to subscribe in your calendar app. Updates here will sync automatically to your personal device.</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 p-2 bg-white border border-slate-300 rounded text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                {`${window.location.origin}/api/calendar/${currentUser.id}.ics`}
              </code>
              <Button variant="secondary" onClick={handleCopyLink} className="shrink-0 min-w-[80px]">
                {copiedLink ? <Check size={16} className="text-green-600" /> : 'Copy Link'}
              </Button>
            </div>
            <div className="mt-4 flex items-start space-x-2 text-xs text-slate-500 bg-white/50 p-2 rounded border border-slate-100">
              <Info size={14} className="shrink-0 mt-0.5 text-purple-500" />
              <p>In your calendar app (Apple, Google, Outlook), choose <span className="font-semibold">"Add Calendar From URL"</span> and paste the link above.</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Event Details">
        {selectedEvent && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {selectedEvent.title}
                {selectedEvent.recurrence !== 'none' && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-normal border border-slate-200 flex items-center"><Repeat size={12} className="mr-1" />{selectedEvent.recurrence}</span>}
              </h3>
              <div className="flex items-center text-slate-500 mt-2 text-sm"><CalendarIcon size={16} className="mr-2" />{selectedEvent.date}</div>
              <div className="flex items-center text-slate-500 mt-1 text-sm"><Clock size={16} className="mr-2" />{selectedEvent.startTime} - {selectedEvent.endTime}</div>
            </div>
            {selectedEvent.description && <div className="bg-slate-50 p-4 rounded-lg text-slate-700 text-sm border border-slate-100 whitespace-pre-wrap">{selectedEvent.description}</div>}
            <div className="flex flex-wrap gap-2">
              {selectedEvent.tags?.map(tag => <span key={tag} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-100">#{tag}</span>)}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center"><Users size={16} className="mr-2" />Attendees</h4>
              <div className="flex flex-wrap gap-2">
                {users.filter(u => selectedEvent.taggedUserIds.includes(u.id)).map(u => (
                  <div key={u.id} className="flex items-center space-x-2 bg-purple-50 border border-purple-100 pl-1 pr-3 py-1 rounded-full"><img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full" /><span className="text-sm font-medium text-purple-900">{u.name}</span></div>
                ))}
                {(!selectedEvent.taggedUserIds || selectedEvent.taggedUserIds.length === 0) && <span className="text-sm text-slate-500">No attendees</span>}
              </div>
            </div>
            {currentUser.role === UserRole.ADMIN && (
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <Button variant="secondary" onClick={handleEditEvent}><Pencil size={16} className="mr-2" />Edit</Button>
                <Button variant="danger" onClick={() => { onDeleteEvent(selectedEvent.id.split('_')[0]); setSelectedEvent(null); }}><Trash2 size={16} className="mr-2" />Delete Series</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={newEvent.id ? "Edit Event" : "Schedule Event"}>
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-slate-50 p-4 rounded-xl border border-purple-100">
            <label className="flex items-center text-sm font-semibold text-purple-700 mb-2"><Wand2 size={16} className="mr-2" />AI Assistant</label>
            <div className="flex gap-2">
              <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Design Sync with Jane next Tuesday at 2pm" className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg outline-none bg-white" />
              <Button onClick={handleAiGenerate} isLoading={isAiLoading} disabled={!aiPrompt}>Fill</Button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input required type="text" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Event Title" className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-medium" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center"><AlignLeft size={14} className="mr-1" />Description</label>
              <textarea 
                value={newEvent.description || ''} 
                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} 
                placeholder="Add event details, meeting links, or notes..." 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none min-h-[80px] text-sm" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <input required type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none" />
              <select value={newEvent.recurrence || 'none'} onChange={e => setNewEvent({ ...newEvent, recurrence: e.target.value as RecurrenceType })} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none">
                <option value="none">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div className="flex gap-4">
              <input required type="time" value={newEvent.startTime} onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none" />
              <input required type="time" value={newEvent.endTime} onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tag Team Members</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                {users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                       const current = newEvent.taggedUserIds || [];
                       const exists = current.includes(u.id);
                       setNewEvent({
                         ...newEvent,
                         taggedUserIds: exists ? current.filter(id => id !== u.id) : [...current, u.id]
                       });
                    }}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                      (newEvent.taggedUserIds || []).includes(u.id) 
                        ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-200' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-white hover:border-purple-200'
                    }`}
                  >
                    <img src={u.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                    <span>{u.name}</span>
                  </button>
                ))}
                {users.length === 0 && <span className="text-xs text-slate-400 p-1">No users available to tag.</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Event Color</label>
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map(option => {
                  const currentSelection = currentUser.role === UserRole.ADMIN ? newEvent.adminColor : newEvent.userColor;
                  const isSelected = (currentSelection || 'purple') === option.id;
                  
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, adminColor: option.id, userColor: option.id })}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${option.class.split(' ')[0]} ${isSelected ? 'ring-2 ring-offset-2 ring-purple-500' : 'opacity-70 hover:opacity-100'}`}
                      title={option.label}
                    >
                      {isSelected && <Check size={14} className="text-current opacity-70" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" className="mr-2" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Event</Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
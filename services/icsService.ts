import { CalendarEvent } from '../types';

export const generateICS = (events: CalendarEvent[], appName = "TeamSync"): string => {
  const formatDateTime = (dateStr: string, timeStr: string) => {
    // dateStr: YYYY-MM-DD, timeStr: HH:mm
    // Result: YYYYMMDDTHHMM00
    return dateStr.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '') + '00';
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${appName}//Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach(event => {
    lines.push('BEGIN:VEVENT');
    // Ensure UID is unique and stable
    lines.push(`UID:${event.id}`);
    // Timestamp for when the object was created/modified. Using current time for export.
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    
    // Start and End times
    lines.push(`DTSTART:${formatDateTime(event.date, event.startTime)}`);
    lines.push(`DTEND:${formatDateTime(event.date, event.endTime)}`);
    
    lines.push(`SUMMARY:${event.title}`);
    
    // Description - escape newlines
    const desc = (event.description || '').replace(/\n/g, '\\n');
    lines.push(`DESCRIPTION:${desc}`);
    
    // Recurrence Rule
    if (event.recurrence && event.recurrence !== 'none') {
      lines.push(`RRULE:FREQ=${event.recurrence.toUpperCase()}`);
    }
    
    // Tags as Categories
    if (event.tags && event.tags.length > 0) {
      lines.push(`CATEGORIES:${event.tags.join(',')}`);
    }
    
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};
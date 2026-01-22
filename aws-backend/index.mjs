import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { Buffer } from "node:buffer";

// Initialize outside handler for connection reuse
let docClient;
try {
  const client = new DynamoDBClient({});
  docClient = DynamoDBDocumentClient.from(client);
} catch (e) {
  console.error("Failed to initialize DynamoDB Client", e);
}

// Table Names
const TABLES = {
  EVENTS: "accellearn_calendar",
  USERS: "accellearn_users_table"
};

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
  "Content-Type": "application/json"
};

// Helper: Generate ICS content string
const generateICS = (events, appName = "Accellearn") => {
  const formatDateTime = (dateStr, timeStr) => {
    // dateStr: YYYY-MM-DD, timeStr: HH:mm
    // Result: YYYYMMDDTHHMM00
    if (!dateStr || !timeStr) return '';
    return dateStr.replace(/-/g, '') + 'T' + timeStr.replace(/:/g, '') + '00';
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${appName}//Calendar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + appName,
  ];

  events.forEach(event => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}`);
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
    
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Fail fast if client didn't init
    if (!docClient) {
      console.error("DynamoDB Client not initialized");
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: "Database Client Initialization Failed. Check AWS Permissions." })
      };
    }

    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    // PRIORITY: 1. Query Param (?route=), 2. Event Path, 3. Raw Path
    let path = event.queryStringParameters?.route || event.path || event.rawPath || "";
    
    // Normalize Path
    if (path.includes('/accellearn-calendar-backend') && !event.queryStringParameters?.route) {
        path = '/'; 
    }

    // Standard routing normalizations
    if (path.endsWith('/login')) path = '/login';
    else if (path.endsWith('/logout')) path = '/logout';
    else if (path.endsWith('/events')) path = '/events';
    else if (path.endsWith('/users')) path = '/users';
    else if (path.includes('/events/')) path = '/events/' + path.split('/events/').pop();
    else if (path.includes('/users/')) path = '/users/' + path.split('/users/').pop();

    console.log(`Processing request: ${httpMethod} ${path}`);

    // Handle Preflight OPTIONS
    if (httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: HEADERS, body: '' };
    }

    // Parse Body
    const parseBody = (ev) => {
      if (!ev.body) return {};
      try {
        let bodyStr = ev.body;
        if (ev.isBase64Encoded) {
          // Use imported Buffer
          bodyStr = Buffer.from(ev.body, 'base64').toString('utf-8');
        }
        return JSON.parse(bodyStr);
      } catch (e) {
        console.error("Failed to parse body:", e);
        return {};
      }
    };

    const body = parseBody(event);

    // --- HEALTH CHECK ---
    if (path === '/' || path === '') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: "API Online" }) };
    }

    // --- ICS FEED ROUTE ---
    // Route format: /calendar/{userId}
    // Updated to support /calendar/{userId}/cal.ics for Apple Calendar compatibility
    if (path.includes('/calendar/') && httpMethod === 'GET') {
      const parts = path.split('/calendar/');
      let userId = parts[1]; // e.g. "user123", "user123.ics", "user123/cal.ics"

      // CLEANUP: Extract pure userId from various path formats
      if (userId.endsWith('/cal.ics')) {
          userId = userId.substring(0, userId.length - '/cal.ics'.length);
      } else if (userId.endsWith('.ics')) {
          userId = userId.substring(0, userId.length - '.ics'.length);
      }
      
      console.log(`Generating ICS feed for user: ${userId}`);

      // 1. Fetch Events
      const command = new ScanCommand({ TableName: TABLES.EVENTS });
      const response = await docClient.send(command);
      const allEvents = response.Items || [];

      // 2. Filter Events for this user
      // SAFEGUARD: DynamoDB sometimes returns Sets for string arrays. convert to array.
      const userEvents = allEvents.filter(e => {
        let tagged = [];
        if (Array.isArray(e.taggedUserIds)) {
            tagged = e.taggedUserIds;
        } else if (e.taggedUserIds && typeof e.taggedUserIds === 'object' && e.taggedUserIds instanceof Set) {
            tagged = Array.from(e.taggedUserIds);
        } else if (e.taggedUserIds) {
            // Fallback for unexpected format
            tagged = [e.taggedUserIds]; 
        }

        return tagged.includes(userId) || e.createdBy === userId;
      });

      // 3. Generate ICS String
      const icsData = generateICS(userEvents);

      // 4. Return as text/calendar with correct feed headers
      return {
        statusCode: 200,
        headers: {
          ...HEADERS,
          "Content-Type": "text/calendar; charset=utf-8",
          // CHANGED: Use 'inline' and ensure filename ends in .ics.
          "Content-Disposition": `inline; filename="accellearn-calendar.ics"`,
          // CHANGED: Prevent caching so Google Calendar sees updates
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: icsData
      };
    }

    // --- LOGIN ROUTE ---
    if (path === '/login' && httpMethod === 'POST') {
      const { username, password } = body;
      console.log(`Attempting login for user: ${username}`);

      // 1. Fetch all users
      const command = new ScanCommand({ TableName: TABLES.USERS });
      const response = await docClient.send(command);
      const users = response.Items || [];
      console.log(`Found ${users.length} users in database.`);

      // 2. SPECIAL CASE: First Run / Empty DB
      if (users.length === 0) {
        console.log("Database is empty. Checking if this is the initial admin login...");
        if (username === 'admin' && password === 'admin') {
           console.log("Creating default admin user...");
           const defaultAdmin = { 
               id: 'admin-1', 
               username: 'admin', 
               password: 'admin', 
               name: 'System Admin', 
               role: 'ADMIN', 
               avatarUrl: 'https://picsum.photos/seed/admin/200' 
           };
           await docClient.send(new PutCommand({ TableName: TABLES.USERS, Item: defaultAdmin }));
           return { statusCode: 200, headers: HEADERS, body: JSON.stringify(defaultAdmin) };
        }
      }

      const user = users.find(u => u.username === username && u.password === password);

      if (user) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(user) };
      }
      
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid credentials." }) };
    }

    // --- EVENTS ROUTES ---
    if (path === '/events') {
      if (httpMethod === 'GET') {
        const command = new ScanCommand({ TableName: TABLES.EVENTS });
        const response = await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response.Items || []) };
      }
      if (httpMethod === 'POST') {
        const command = new PutCommand({ TableName: TABLES.EVENTS, Item: body });
        await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
      }
    }

    if (path.startsWith('/events/') && httpMethod === 'DELETE') {
      const id = path.split('/').pop();
      const command = new DeleteCommand({ TableName: TABLES.EVENTS, Key: { id } });
      await docClient.send(command);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
    }

    // --- USERS ROUTES ---
    if (path === '/users') {
      if (httpMethod === 'GET') {
        const command = new ScanCommand({ TableName: TABLES.USERS });
        const response = await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response.Items || []) };
      }
      if (httpMethod === 'POST') {
        const command = new PutCommand({ TableName: TABLES.USERS, Item: body });
        await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
      }
    }

    if (path.startsWith('/users/') && httpMethod === 'DELETE') {
      const id = path.split('/').pop();
      const command = new DeleteCommand({ TableName: TABLES.USERS, Key: { id } });
      await docClient.send(command);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
    }

    // --- LOGOUT ---
    if (path === '/logout') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: `Route not found: ${path}` }) };

  } catch (err) {
    console.error("Backend Critical Error:", err);
    // Ensure we return CORS headers even on error
    return { 
      statusCode: 500, 
      headers: HEADERS, 
      body: JSON.stringify({ error: err.message || "Internal Server Error" }) 
    };
  }
};
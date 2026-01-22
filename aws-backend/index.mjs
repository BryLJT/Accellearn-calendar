import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Table Names (Must match what you created in Phase 2)
const TABLES = {
  EVENTS: "TeamSync_Events",
  USERS: "TeamSync_Users"
};

const HEADERS = {
  "Access-Control-Allow-Origin": "*", // Allow Amplify to hit this
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // 1. Handle CORS Preflight (Browser checking permission)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const { httpMethod, path, body } = event;
  const data = body ? JSON.parse(body) : {};

  try {
    // --- LOGIN ROUTE ---
    if (path === '/login' && httpMethod === 'POST') {
      const { username, password } = data;
      // Scan users to find match (Simple auth for small teams)
      const command = new ScanCommand({ TableName: TABLES.USERS });
      const response = await docClient.send(command);
      const user = response.Items.find(u => u.username === username && u.password === password);

      if (user) {
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(user) };
      }
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid credentials" }) };
    }

    // --- EVENTS ROUTES ---
    if (path === '/events') {
      if (httpMethod === 'GET') {
        const command = new ScanCommand({ TableName: TABLES.EVENTS });
        const response = await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response.Items || []) };
      }
      if (httpMethod === 'POST') {
        // 'data' is the CalendarEvent object
        const command = new PutCommand({ TableName: TABLES.EVENTS, Item: data });
        await docClient.send(command);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
      }
    }

    // Handle /events/{id} for DELETE
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
        
        // If no users exist, create default Admin (Bootstrap)
        if (!response.Items || response.Items.length === 0) {
           const defaultAdmin = { 
             id: 'admin-1', 
             username: 'admin', 
             password: 'admin', 
             name: 'System Admin', 
             role: 'ADMIN', 
             avatarUrl: 'https://picsum.photos/seed/admin/200' 
           };
           await docClient.send(new PutCommand({ TableName: TABLES.USERS, Item: defaultAdmin }));
           return { statusCode: 200, headers: HEADERS, body: JSON.stringify([defaultAdmin]) };
        }
        
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(response.Items) };
      }
      if (httpMethod === 'POST') {
        const command = new PutCommand({ TableName: TABLES.USERS, Item: data });
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

    // --- LOGOUT ROUTE ---
    if (path === '/logout') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Route not found" }) };

  } catch (err) {
    console.error("Backend Error:", err);
    return { 
      statusCode: 500, 
      headers: HEADERS, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};

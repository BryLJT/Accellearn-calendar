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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET,DELETE"
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // 1. Normalize Event Data (Handles both REST API v1 and HTTP API v2)
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  let path = event.path || event.rawPath || "";
  
  // 2. Normalize Path (Remove stage prefix if present, e.g., /default/login -> /login)
  // This ensures the code works regardless of your API Gateway stage configuration.
  if (path.endsWith('/login')) path = '/login';
  else if (path.endsWith('/logout')) path = '/logout';
  else if (path.endsWith('/events')) path = '/events';
  else if (path.endsWith('/users')) path = '/users';
  else if (path.includes('/events/')) path = '/events/' + path.split('/events/').pop();
  else if (path.includes('/users/')) path = '/users/' + path.split('/users/').pop();

  // 3. Handle CORS Preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // --- LOGIN ROUTE ---
    if (path === '/login' && httpMethod === 'POST') {
      const { username, password } = body;
      const command = new ScanCommand({ TableName: TABLES.USERS });
      const response = await docClient.send(command);
      const user = response.Items?.find(u => u.username === username && u.password === password);

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
        
        // Bootstrap Default Admin if empty
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

    // --- LOGOUT ROUTE ---
    if (path === '/logout') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: `Route not found: ${path}` }) };

  } catch (err) {
    console.error("Backend Error:", err);
    return { 
      statusCode: 500, 
      headers: HEADERS, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
};
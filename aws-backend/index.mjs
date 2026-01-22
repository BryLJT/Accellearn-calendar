import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { Buffer } from "buffer";

// Initialize outside handler for connection reuse, but handle potential env errors gracefully
let docClient;
try {
  const client = new DynamoDBClient({});
  docClient = DynamoDBDocumentClient.from(client);
} catch (e) {
  console.error("Failed to initialize DynamoDB Client", e);
}

// Table Names - Updated to match your specific tables
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

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Fail fast if client didn't init
  if (!docClient) {
    console.error("DynamoDB Client not initialized");
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: "Database Client Initialization Failed. Check AWS Permissions." })
    };
  }

  try {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    let path = event.queryStringParameters?.route || event.path || event.rawPath || "";
    
    // Normalize Path
    if (path.endsWith('/login')) path = '/login';
    else if (path.endsWith('/logout')) path = '/logout';
    else if (path.endsWith('/events')) path = '/events';
    else if (path.endsWith('/users')) path = '/users';
    else if (path.includes('/events/')) path = '/events/' + path.split('/events/').pop();
    else if (path.includes('/users/')) path = '/users/' + path.split('/users/').pop();

    console.log(`Processing request: ${httpMethod} ${path}`);

    // Parse Body
    let body = /** @type {any} */ ({});
    if (event.body) {
      try {
        let bodyStr = event.body;
        if (event.isBase64Encoded) {
          bodyStr = Buffer.from(event.body, 'base64').toString('utf-8');
        }
        body = JSON.parse(bodyStr);
      } catch (e) {
        console.error("Failed to parse body:", e);
      }
    }

    // --- HEALTH CHECK ---
    if (path === '/' || path === '') {
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ status: "API Online" }) };
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
      // If the DB has 0 users, we AUTOMATICALLY create the admin user so you can log in.
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
           console.log("Default admin created successfully.");
           return { statusCode: 200, headers: HEADERS, body: JSON.stringify(defaultAdmin) };
        } else {
           console.log("Empty DB, but credentials were not admin/admin.");
        }
      }

      // 3. Normal Login Check
      const user = users.find(u => u.username === username && u.password === password);

      if (user) {
        console.log("Login successful.");
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify(user) };
      }
      
      console.log("Login failed: Invalid credentials.");
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid credentials. If this is your first time, use admin/admin." }) };
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
    return { 
      statusCode: 500, 
      headers: HEADERS, 
      body: JSON.stringify({ error: err.message || "Internal Server Error" }) 
    };
  }
};
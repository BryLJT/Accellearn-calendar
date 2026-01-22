import { GoogleGenAI, Type } from "@google/genai";
import { User, AIEventParseResult } from '../types';

// Initialize Gemini Client
// NOTE: In a real production app, API calls should be proxied through a backend to protect the key.
// Since this is a self-hosted requirement simulation, we use the env var directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseEventWithAI = async (
  promptText: string,
  availableUsers: User[]
): Promise<AIEventParseResult | null> => {
  try {
    const userContext = availableUsers.map(u => ({ id: u.id, name: u.name, username: u.username }));
    const today = new Date().toISOString();

    const systemInstruction = `
      You are an intelligent calendar assistant.
      Your goal is to extract event details from natural language input.
      
      Current Date context: ${today}
      
      Available Users for tagging:
      ${JSON.stringify(userContext)}
      
      Rules:
      1. Match names in the prompt to the 'Available Users' list loosely (e.g., "Mike" matches "Michael").
      2. Return ISO dates (YYYY-MM-DD) and 24h time (HH:mm).
      3. If no duration is specified, assume 1 hour.
      4. If users are mentioned, include their exact IDs in 'taggedUserIds'.
      5. Extract recurrence patterns if mentioned (e.g., "every week", "daily"). Options: 'none', 'daily', 'weekly', 'monthly'.
      6. Extract category tags or hashtags as plain strings in the 'tags' array (e.g., "#urgent" -> "Urgent").
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            startTime: { type: Type.STRING, description: "HH:mm" },
            endTime: { type: Type.STRING, description: "HH:mm" },
            description: { type: Type.STRING },
            taggedUserIds: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            recurrence: {
              type: Type.STRING,
              enum: ['none', 'daily', 'weekly', 'monthly']
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIEventParseResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
};
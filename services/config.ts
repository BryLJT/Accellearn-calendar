
/**
 * APP CONFIGURATION
 * This is the central hub for your environment settings.
 */

export const CONFIG = {
  // -------------------------------------------------------------------------
  // FINAL STEP: CONNECTING TO AWS
  // -------------------------------------------------------------------------
  // Configured with the exact API Endpoint provided by your AWS Console.
  // This points directly to the 'accellearn-calendar-backend' route.
  
  API_URL: 'https://fwd366kkwe.execute-api.us-east-1.amazonaws.com/default/accellearn-calendar-backend',
  
  // -------------------------------------------------------------------------
  
  // Auto-detect if we are in cloud mode
  get IS_CLOUD() {
    return this.API_URL.length > 0;
  }
};

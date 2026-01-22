
/**
 * APP CONFIGURATION
 * This is the central hub for your environment settings.
 */

export const CONFIG = {
  // -------------------------------------------------------------------------
  // FINAL STEP: CONNECTING TO AWS
  // -------------------------------------------------------------------------
  // You have finished Phase 1-4. Now complete Phase 5.
  // 1. Go to AWS API Gateway Console.
  // 2. Find your "Stages" (usually named 'prod' or 'dev').
  // 3. Copy the "Invoke URL" (e.g., https://abc.execute-api.us-east-1.amazonaws.com/prod)
  // 4. Paste it inside the quotes below.
  
  API_URL: '',
  
  // -------------------------------------------------------------------------
  
  // Auto-detect if we are in cloud mode
  get IS_CLOUD() {
    return this.API_URL.length > 0;
  }
};

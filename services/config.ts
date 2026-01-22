
/**
 * APP CONFIGURATION
 * This is the central hub for your environment settings.
 */

export const CONFIG = {
  // We use the API ID found in your ARN: fwd366kkwe
  API_URL: 'https://fwd366kkwe.execute-api.us-east-1.amazonaws.com',
  
  // Auto-detect if we are in cloud mode
  get IS_CLOUD() {
    return this.API_URL.length > 0;
  }
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const WS_PATH    = '/notifications/socket.io';
export const BT_WS_PATH = '/bluetooth-ws/socket.io';
export const RC_WS_PATH = '/rc/socket.io';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Location Matcher';

export const AUTH_STORAGE_KEYS = {
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
};

export const NOTIFICATION_TYPES = {
  USER_REGISTERED: 'user_registered',
  USER_FOLLOWED: 'user_followed',
  USER_UNFOLLOWED: 'user_unfollowed',
  PROFILE_UPDATED: 'profile_updated',
  NEARBY_USER_FOUND: 'nearby_user_found',
  LOCATION_UPDATED: 'location_updated',
  MESSAGE_RECEIVED: 'message_received',
  SYSTEM_ALERT: 'system_alert',
  MATCH_FOUND: 'match_found',
};

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0,
};

export const NEARBY_SEARCH_RADIUS = 200; // meters
export const DEFAULT_LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds
export const DEFAULT_NEARBY_SEARCH_INTERVAL = 60000; // 1 minute
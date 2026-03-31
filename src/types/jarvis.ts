export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'navigating';

export type JarvisActionType =
  | 'navigate'
  | 'speak_only'
  | 'show_data'
  | 'sync_strava'
  | 'sync_garmin'
  | 'regenerate_dna';

export interface JarvisAction {
  type: JarvisActionType;
  route?: string;
  data_key?: string;
}

export interface JarvisResponse {
  text: string;
  action: JarvisAction;
  audio?: string; // Base64 encoded audio from Fish Audio
  error?: string;
}

export type JarvisDisplayMode = 'intro' | 'fullscreen' | 'mini';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

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
  error?: string;
}

export type JarvisDisplayMode = 'intro' | 'fullscreen' | 'mini';

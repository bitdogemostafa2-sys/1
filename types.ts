
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  STRATEGY = 'STRATEGY',
  CONTENT_GENERATOR = 'CONTENT_GENERATOR',
  VISUAL_STUDIO = 'VISUAL_STUDIO',
  AUDIO_STUDIO = 'AUDIO_STUDIO',
  SMART_EDITOR = 'SMART_EDITOR',
  PUBLISHING = 'PUBLISHING',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS'
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  subscribers: string;
  views: string;
  videoCount?: string;
  description?: string; 
  publishedAt?: string; 
  country?: string;     
  isActive: boolean;
  isVerified?: boolean;
}

export interface Trend {
  topic: string;
  relevance: number;
  growth: string;
  suggestion: string;
}

export interface Scene {
  timestamp: string;
  narration: string; 
  visualCue: string; 
  description?: string; 
  suggestedMotion?: MotionType;
  // NEW: AI Mixing Data
  sfxCue?: string; // Specific SFX name from library
  voiceIntensity?: number; // 0.0 to 1.0 (How loud the voice should be)
  musicIntensity?: number; // 0.0 to 1.0 (Auto-ducking level)
}

export interface Source {
    title: string;
    uri: string;
}

export interface ScriptData {
  title: string;
  alternatives: Array<{title: string, score: number}>;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
  description: string;
  scenes: Scene[];
  tone?: string; 
  sources?: Source[];
  musicMood?: string; 
  selectedMusicTrackId?: string; 
  mixingSettings?: { 
      voice: number;
      music: number;
  };
}

export interface AudioAsset {
    id: string;
    type: 'voiceover' | 'music' | 'sfx';
    name: string;
    duration: string;
    url?: string;
    startTime?: number; // In seconds
}

export type MotionType = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'corner-zoom' | 'tilt-up' | 'tilt-down' | 'shake' | 'pulse';
export type AssetSource = 'gemini' | 'google_search' | 'pexels' | 'pixabay';

export interface SceneAsset {
    sceneIndex: number;
    prompt: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    type: 'image' | 'video';
    source?: AssetSource; 
    motion?: MotionType; 
}

export type VideoDuration = 'short' | 'medium' | 'long' | 'custom';
export type OverlayType = 'subscribe' | 'like' | 'notification' | 'text';

export interface Overlay {
    id: string;
    type: OverlayType;
    url: string; 
    startTime: number;
    duration: number;
    position: { x: number, y: number };
}

export interface ProjectState {
  language: 'ar' | 'en';
  duration: VideoDuration;
  customDuration?: number; 
  topic: string;
  tone: string; 
  script: ScriptData | null;
  thumbnails: string[]; 
  sceneAssets: SceneAsset[]; 
  generatedVideos: string[]; 
  audioTracks: AudioAsset[];
  
  // Editor State
  intro?: string | null;
  outro?: string | null;
  overlays: Overlay[]; 
  
  pexelsKey?: string;
  pixabayKey?: string;
  // Audio Mixing Settings
  voiceVolume: number; 
  musicVolume: number; 
}

export interface GlobalTask {
    id: string;
    type: 'CONTENT_GEN' | 'VISUAL_BATCH' | 'AUDIO_BATCH';
    title: string;
    progress: number; 
    status: 'running' | 'completed' | 'error';
    logs: string[];
    isMinimized: boolean;
}

export interface FullBackup {
    version: number;
    timestamp: number;
    project: ProjectState;
    channels: Channel[];
    settings: {
        [key: string]: string | null;
    };
}

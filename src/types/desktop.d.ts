export interface InternetSharingState {
  phase: 'idle' | 'downloading' | 'connecting' | 'reconnecting' | 'active' | 'stopping' | 'error';
  version?: string; progress?: number; pin?: string; url?: string; error?: string; detail?: string;
}
export interface InternetSharingApi {
  status: () => Promise<InternetSharingState>;
  start: (pin: string) => Promise<InternetSharingState>;
  stop: () => Promise<InternetSharingState>;
  /** Stops sharing the current game but keeps an open tunnel for the next one. */
  release?: () => Promise<InternetSharingState>;
  onChange: (callback: (state: InternetSharingState) => void) => () => void;
}
export type DesktopMenuCommand = 'new-quiz' | 'new-video-quiz' | 'import-questions' | 'backup' | 'guide' | 'about';
export interface DesktopMenuApi {
  onCommand: (callback: (command: DesktopMenuCommand) => void) => () => void;
  setLibraryVisible: (visible: boolean) => void;
  setLanguage?: (language: string) => void;
}
declare global {
  interface Window {
    quriosoDesktop?: Readonly<{ serverPort: number; systemLanguage?: 'it' | 'en' | 'de'; internetSharing?: InternetSharingApi; menu?: DesktopMenuApi }>;
  }
}

export interface InternetSharingState {
  phase: 'idle' | 'downloading' | 'connecting' | 'reconnecting' | 'active' | 'stopping' | 'error';
  version?: string; progress?: number; pin?: string; url?: string; error?: string; detail?: string;
}
export interface InternetSharingApi {
  status: () => Promise<InternetSharingState>;
  start: (pin: string) => Promise<InternetSharingState>;
  stop: () => Promise<InternetSharingState>;
  onChange: (callback: (state: InternetSharingState) => void) => () => void;
}
export type DesktopMenuCommand = 'new-quiz' | 'new-video-quiz' | 'import-questions' | 'backup' | 'guide' | 'about';
export interface DesktopMenuApi {
  onCommand: (callback: (command: DesktopMenuCommand) => void) => () => void;
  setLibraryVisible: (visible: boolean) => void;
}
declare global {
  interface Window {
    quriosoDesktop?: Readonly<{ serverPort: number; internetSharing?: InternetSharingApi; menu?: DesktopMenuApi }>;
  }
}

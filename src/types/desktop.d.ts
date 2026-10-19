export {};
declare global {
  interface Window {
    quriosoDesktop?: Readonly<{ serverPort: number }>;
  }
}

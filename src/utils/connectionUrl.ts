export interface ConnectionInfo { port: number | string; localIps: string[] }

export function isLoopbackOrigin(origin: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(new URL(origin).hostname);
}

export function getJoinBaseUrl(origin: string, info: ConnectionInfo | null, mode: 'origin' | 'lan'): string {
  if (mode === 'lan' && info?.localIps.length) {
    return `http://${info.localIps[0]}:${info.port}`;
  }
  return origin;
}

export interface ConnectionInfo { port: number | string; localIps: string[] }

/** Public addresses only; presenter credentials must never be part of a join URL. */
export function getJoinAddresses(origin: string, info: ConnectionInfo | null): string[] {
  const addresses = (info?.localIps || []).map(ip => `http://${ip}:${info!.port}`);
  if (!isLoopbackOrigin(origin)) addresses.unshift(origin);
  return [...new Set(addresses)];
}

export function isLoopbackOrigin(origin: string): boolean {
  return ['qurioso.localhost', 'localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(new URL(origin).hostname);
}

export function getJoinBaseUrl(origin: string, info: ConnectionInfo | null, mode: 'origin' | 'lan'): string {
  if (mode === 'lan' && info?.localIps.length) {
    return `http://${info.localIps[0]}:${info.port}`;
  }
  return origin;
}

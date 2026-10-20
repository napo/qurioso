import type { IncomingMessage } from 'node:http';

const loopback = (address?: string) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address || '');
export interface PublicShare { origin: string; pin: string }

/** cloudflared targets the existing server with an unguessable native-only Host header. */
export function createPublicAccess(secret: string | undefined) {
  let share: PublicShare | null = null;
  const host = secret ? `qurioso-public-${secret}.localhost` : '';
  const isPublic = (request: IncomingMessage) => Boolean(host && request.headers.host === host);
  const snapshot = () => share;
  const configure = (value: unknown) => {
    if (value === null) { share = null; return; }
    const candidate = value as PublicShare;
    const url = new URL(candidate?.origin);
    if (url.protocol !== 'https:' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname) ||
        url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^\d{6}$/.test(candidate?.pin)) throw new Error('Invalid public share');
    share = { origin: url.origin, pin: candidate.pin };
  };
  const controlAllowed = (request: IncomingMessage) => Boolean(secret && loopback(request.socket.remoteAddress) &&
    !isPublic(request) && request.headers.authorization === `Bearer ${secret}` && !request.headers.origin);
  const originAllowed = (request: IncomingMessage) => Boolean(share && loopback(request.socket.remoteAddress) &&
    (!request.headers.origin || request.headers.origin === share.origin));
  const routeAllowed = (method: string, pathname: string) => {
    if (!share) return false;
    // Express routes are case-insensitive: mixed-case API paths must not pass as assets.
    if (!/^\/api(?:\/|$)/i.test(pathname)) return method === 'GET' || method === 'HEAD';
    const base = `/api/session/${share.pin}`;
    if (method === 'GET') return pathname === base || new RegExp(`^${base}/player/[a-zA-Z0-9_-]+$`).test(pathname);
    if (method === 'POST') return [`${base}/join`, `${base}/answer`].includes(pathname) || new RegExp(`^${base}/player/[a-zA-Z0-9_-]+/leave$`).test(pathname);
    return false;
  };
  return { host, isPublic, snapshot, configure, controlAllowed, originAllowed, routeAllowed };
}

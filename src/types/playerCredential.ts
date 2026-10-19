/** Same fixed lifetime on server and browser; recovery never renews it. */
export const PLAYER_CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;
export interface PlayerCredential { pin: string; playerId: string; token: string; expiresAt: number }
export function playerCredentialExpired(expiresAt: number | undefined, now = Date.now()): boolean {
  return !Number.isFinite(expiresAt) || now >= expiresAt!;
}

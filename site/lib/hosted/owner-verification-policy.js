// A high-entropy code is configured only in private Sites settings. The code
// is compared in memory and is never stored in the database or returned.
export const OWNER_PAIRING_MIN_LENGTH = 32;
export const OWNER_PAIRING_MAX_LENGTH = 128;
export const OWNER_PAIRING_MAX_ATTEMPTS = 5;
export const OWNER_PAIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function validOwnerPairingCode(value) {
  return typeof value === "string"
    && value.length >= OWNER_PAIRING_MIN_LENGTH
    && value.length <= OWNER_PAIRING_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value);
}

export function isPairedOwner(authenticatedUserId, boundUserId) {
  return typeof authenticatedUserId === "string" && authenticatedUserId.length > 0
    && typeof boundUserId === "string" && boundUserId.length > 0
    && authenticatedUserId === boundUserId;
}

// Hash both strings to a fixed length before comparing every digest byte.
export async function pairingCodesMatch(candidate, configured) {
  if (!validOwnerPairingCode(configured) || typeof candidate !== "string") return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([candidate, configured].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))));
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

// The first five attempts in a rolling window are reserved atomically for
// this signed-in account. A sixth attempt makes no change.
export const RESERVE_OWNER_PAIRING_ATTEMPT_SQL = `INSERT INTO owner_pairing_attempts (user_id,attempts,window_started_at) VALUES (?,1,?)
  ON CONFLICT(user_id) DO UPDATE SET
    attempts=CASE WHEN window_started_at<=? THEN 1 ELSE attempts+1 END,
    window_started_at=CASE WHEN window_started_at<=? THEN ? ELSE window_started_at END
  WHERE window_started_at<=? OR attempts<?`;

export const CLAIM_OWNER_SLOT_SQL = "INSERT OR IGNORE INTO site_owner_identity (slot,user_id,verified_at) VALUES ('owner',?,?)";

export function ownerPairingWindowStart(now) {
  return new Date(now.getTime() - OWNER_PAIRING_WINDOW_MS).toISOString();
}

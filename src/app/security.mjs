import bcrypt from "bcryptjs";

const SESSION_TOKEN_BYTES = 32;

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES));
  return bytesToHex(bytes);
}

export function createCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES));
  return bytesToHex(bytes);
}

export async function hashSessionToken(token) {
  const buffer = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

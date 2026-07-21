/**
 * AES-256-GCM encryption helpers for sensitive database fields.
 * Payload format: IV (12 bytes) || authTag (16 bytes) || ciphertext.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * @param plaintext - The string to encrypt.
 * @param key - 32-byte encryption key.
 * @returns Buffer containing IV || authTag || ciphertext.
 */
export function encrypt(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt an AES-256-GCM payload.
 * @param payload - Buffer containing IV || authTag || ciphertext.
 * @param key - 32-byte encryption key.
 * @returns The decrypted plaintext string.
 */
export function decrypt(payload: Buffer, key: Buffer): string {
  if (!Buffer.isBuffer(payload) || payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error(`Invalid encrypted payload: expected at least ${IV_LENGTH + TAG_LENGTH} bytes, got ${payload?.length ?? 0}`);
  }
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}

/**
 * Generate a random 32-byte encryption key.
 */
export function generateKey(): Buffer {
  return randomBytes(32);
}

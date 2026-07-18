/**
 * Encryption service for BidLens persistence layer.
 * AES-256-GCM with unique nonce per payload.
 * Authenticated AAD containing record identity + payload version.
 * Compression before encryption (zlib).
 */
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 16;   // 128 bits authentication tag
const PAYLOAD_VERSION = 1;

export interface EncryptionEnvelope {
  version: number;
  nonce: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}

export interface AADContext {
  /** Record type (e.g., 'document_ast', 'diff_ast', 'annotation_note', 'file_path') */
  recordType: string;
  /** Record identifier (e.g., task_id, annotation_id) */
  recordId: string;
  /** Side identifier if applicable ('a' or 'b') */
  side?: string;
}

/**
 * Build Additional Authenticated Data (AAD) for integrity verification.
 * AAD binds ciphertext to its record identity.
 */
function buildAAD(context: AADContext, version: number): Buffer {
  const parts = [
    context.recordType,
    context.recordId,
    context.side ?? '',
    String(version),
  ];
  return Buffer.from(parts.join('|'), 'utf8');
}

/**
 * Compress data using zlib deflate (async, level 1 for speed).
 */
async function compress(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.deflate(data, { level: 1 }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Decompress data using zlib inflate (async).
 */
async function decompress(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.inflate(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Encrypt a payload with AES-256-GCM.
 * 1. Compress the plaintext (async)
 * 2. Generate random nonce
 * 3. Encrypt with AAD
 * 4. Return envelope with nonce, tag, and ciphertext
 */
export async function encrypt(
  plaintext: Buffer,
  key: Buffer,
  context: AADContext
): Promise<EncryptionEnvelope> {
  // Compress before encryption
  const compressed = await compress(plaintext);

  // Generate unique nonce
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  // Build AAD
  const aad = buildAAD(context, PAYLOAD_VERSION);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(aad);

  // Encrypt
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: PAYLOAD_VERSION,
    nonce,
    tag,
    ciphertext: encrypted,
  };
}

/**
 * Decrypt an envelope with AES-256-GCM.
 * 1. Verify AAD integrity
 * 2. Decrypt ciphertext
 * 3. Decompress plaintext (async)
 *
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(
  envelope: EncryptionEnvelope,
  key: Buffer,
  context: AADContext
): Promise<Buffer> {
  // Rebuild AAD
  const aad = buildAAD(context, envelope.version);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, envelope.nonce, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(envelope.tag);

  // Decrypt
  const compressed = Buffer.concat([
    decipher.update(envelope.ciphertext),
    decipher.final(),
  ]);

  // Decompress
  return decompress(compressed);
}

/**
 * Serialize an envelope to a single Buffer for storage.
 * Format: [version:1][nonce_len:1][nonce][tag][ciphertext]
 */
export function serializeEnvelope(envelope: EncryptionEnvelope): Buffer {
  const header = Buffer.alloc(2);
  header.writeUInt8(envelope.version, 0);
  header.writeUInt8(envelope.nonce.length, 1);
  return Buffer.concat([header, envelope.nonce, envelope.tag, envelope.ciphertext]);
}

/**
 * Deserialize a Buffer back into an envelope.
 */
export function deserializeEnvelope(data: Buffer): EncryptionEnvelope {
  if (data.length < 2 + NONCE_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid envelope: too short');
  }

  const version = data.readUInt8(0);
  const nonceLen = data.readUInt8(1);
  const nonce = data.subarray(2, 2 + nonceLen);
  const tag = data.subarray(2 + nonceLen, 2 + nonceLen + TAG_LENGTH);
  const ciphertext = data.subarray(2 + nonceLen + TAG_LENGTH);

  return { version, nonce, tag, ciphertext };
}

/**
 * Encrypt a string payload.
 */
export async function encryptString(
  plaintext: string,
  key: Buffer,
  context: AADContext
): Promise<EncryptionEnvelope> {
  return encrypt(Buffer.from(plaintext, 'utf8'), key, context);
}

/**
 * Decrypt to a string.
 */
export async function decryptString(
  envelope: EncryptionEnvelope,
  key: Buffer,
  context: AADContext
): Promise<string> {
  return (await decrypt(envelope, key, context)).toString('utf8');
}

/**
 * Encrypt and serialize in one step (for direct storage).
 */
export async function encryptToBuffer(
  plaintext: Buffer,
  key: Buffer,
  context: AADContext
): Promise<Buffer> {
  return serializeEnvelope(await encrypt(plaintext, key, context));
}

/**
 * Deserialize and decrypt in one step (for direct storage).
 */
export async function decryptFromBuffer(
  data: Buffer,
  key: Buffer,
  context: AADContext
): Promise<Buffer> {
  return decrypt(deserializeEnvelope(data), key, context);
}

/**
 * Key manager for BidLens encryption.
 * Generates random master key and wraps it with Electron safeStorage (DPAPI on Windows).
 * Never logs or stores plaintext key.
 */
import { safeStorage } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_FILE_NAME = '.bidlens-key.enc';
const KEY_LENGTH = 32; // 256 bits for AES-256

export interface KeyStorage {
  isAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

const electronKeyStorage: KeyStorage = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (value) => safeStorage.encryptString(value),
  decrypt: (value) => safeStorage.decryptString(value),
};

export class KeyManager {
  private masterKey: Buffer | null = null;
  private readonly keyPath: string;

  constructor(dataDir: string, private readonly keyStorage: KeyStorage = electronKeyStorage) {
    this.keyPath = path.join(dataDir, KEY_FILE_NAME);
  }

  /**
   * Check if safeStorage is available on this platform.
   */
  isSafeStorageAvailable(): boolean {
    try {
      return this.keyStorage.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Initialize the key manager. Loads existing key or generates a new one.
   * Must be called before getKey().
   */
  initialize(): void {
    if (this.masterKey) return;

    if (fs.existsSync(this.keyPath)) {
      this.loadKey();
    } else {
      this.generateAndStoreKey();
    }
  }

  /**
   * Get the master key. Throws if not initialized.
   * Returns a copy to prevent external mutation.
   */
  getKey(): Buffer {
    if (!this.masterKey) {
      throw new Error('KeyManager not initialized. Call initialize() first.');
    }
    return Buffer.from(this.masterKey);
  }

  /**
   * Generate a new random master key and store it encrypted.
   */
  private generateAndStoreKey(): void {
    const key = crypto.randomBytes(KEY_LENGTH);

    if (!this.isSafeStorageAvailable()) {
      key.fill(0);
      throw new Error('Secure key storage is unavailable; encrypted persistence is disabled.');
    }

    const encrypted = this.keyStorage.encrypt(key.toString('base64'));
    fs.writeFileSync(this.keyPath, encrypted);

    this.masterKey = key;
  }

  /**
   * Load existing key from disk.
   */
  private loadKey(): void {
    try {
      const fileContent = fs.readFileSync(this.keyPath);

      if (!this.isSafeStorageAvailable()) {
        throw new Error('Secure key storage is unavailable.');
      }

      const base64 = this.keyStorage.decrypt(fileContent);
      this.masterKey = Buffer.from(base64, 'base64');

      // Validate key length
      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: ${this.masterKey.length}, expected ${KEY_LENGTH}`);
      }
    } catch (err) {
      console.error('[KeyManager] Failed to load key:', err);
      throw new Error('Failed to load encryption key. Database may be unreadable.');
    }
  }

  /**
   * Clear key from memory. Call on app shutdown.
   */
  destroy(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
  }
}

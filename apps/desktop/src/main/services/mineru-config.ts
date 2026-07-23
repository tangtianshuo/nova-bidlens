/**
 * MinerU configuration service.
 * Stores API token encrypted via Electron safeStorage (DPAPI on Windows).
 * Follows same pattern as KeyManager.
 */
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../logger';

const TOKEN_FILE_NAME = '.mineru-token.enc';
const MINERU_BATCH_URL = 'https://mineru.net/api/v4/file-urls/batch';

export class MineruConfigService {
  private readonly tokenPath: string;

  constructor(dataDir: string) {
    this.tokenPath = path.join(dataDir, TOKEN_FILE_NAME);

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is unavailable; MinerU token encryption is disabled.');
    }
  }

  /**
   * Get decrypted API token, or null if not stored.
   */
  getToken(): string | null {
    if (!fs.existsSync(this.tokenPath)) return null;

    try {
      const encrypted = fs.readFileSync(this.tokenPath);
      return safeStorage.decryptString(encrypted);
    } catch (err) {
      log.error('[MineruConfig] Failed to read token:', err);
      return null;
    }
  }

  /**
   * Encrypt and store API token.
   */
  setToken(token: string): void {
    const encrypted = safeStorage.encryptString(token);
    fs.writeFileSync(this.tokenPath, encrypted);
    log.info('[MineruConfig] Token saved');
  }

  /**
   * Delete stored token.
   */
  deleteToken(): void {
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
    log.info('[MineruConfig] Token deleted');
  }

  /**
   * Get masked token for display (e.g., "sk-gq...DX9p8dS").
   * Returns null if no token stored.
   */
  getMaskedToken(): string | null {
    const token = this.getToken();
    if (!token) return null;

    if (token.length <= 8) return token;
    return `${token.slice(0, 5)}...${token.slice(-6)}`;
  }

  /**
   * Validate token by making a test batch API call.
   * If token arg is provided, uses that; otherwise uses stored token.
   */
  async validateToken(token?: string): Promise<{ valid: boolean; error?: string }> {
    const testToken = token ?? this.getToken();
    if (!testToken) {
      return { valid: false, error: 'Token not configured' };
    }

    try {
      const res = await fetch(MINERU_BATCH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{ name: 'test.pdf', data_id: 'test' }],
          model_version: 'pipeline',
        }),
      });

      if (res.status === 401) {
        log.info('[MineruConfig] Token validation: 401 unauthorized');
        return { valid: false, error: '认证失败' };
      }

      if (!res.ok) {
        log.warn('[MineruConfig] Token validation: HTTP', res.status);
        return { valid: false, error: `API 错误: ${res.status}` };
      }

      const data = await res.json() as { code: number };
      if (data.code === 0) {
        log.info('[MineruConfig] Token validation: OK');
        return { valid: true };
      }

      log.warn('[MineruConfig] Token validation: code', data.code);
      return { valid: false, error: `API 错误: code ${data.code}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log.error('[MineruConfig] Token validation failed:', msg);
      return { valid: false, error: `Network error: ${msg}` };
    }
  }
}

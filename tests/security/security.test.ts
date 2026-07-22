/**
 * Security test suite — offline operation, encrypted DB/WAL, deletion closure.
 * Requirements: QA-03
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { encrypt, decrypt, generateKey } from '../../apps/desktop/src/main/db/crypto';
import {
  CREATE_TABLES_SQL,
  ENABLE_WAL_SQL,
  ENABLE_FOREIGN_KEYS_SQL,
} from '../../apps/desktop/src/main/db/schema';

const MAIN_SRC_DIR = path.resolve(__dirname, '../../apps/desktop/src/main');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

function getRelativeImportPaths(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];

  // Static imports: import ... from '...'
  const staticRe = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(content)) !== null) {
    imports.push(m[1]);
  }

  // Dynamic imports: import('...')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(content)) !== null) {
    imports.push(m[1]);
  }

  // require('...')
  const reqRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(content)) !== null) {
    imports.push(m[1]);
  }

  return imports;
}

// ---------------------------------------------------------------------------
// 1. Offline operation — no network client imports
// ---------------------------------------------------------------------------

describe('offline operation', () => {
  it('main process has no network client imports', () => {
    const networkModules = [
      'node-fetch', 'axios', 'got', 'undici',
      'superagent', 'cross-fetch', 'isomorphic-fetch',
    ];

    const tsFiles = walkTsFiles(MAIN_SRC_DIR);
    const violations: Array<{ file: string; module: string }> = [];

    for (const file of tsFiles) {
      const imports = getRelativeImportPaths(file);
      const relFile = path.relative(MAIN_SRC_DIR, file);

      for (const imp of imports) {
        if (networkModules.includes(imp)) {
          violations.push({ file: relFile, module: imp });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('main process does not use global fetch()', () => {
    const tsFiles = walkTsFiles(MAIN_SRC_DIR);
    const violations: string[] = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relFile = path.relative(MAIN_SRC_DIR, file);
      // Match fetch( but not imports — just direct calls
      if (/\bfetch\s*\(/.test(content) && !content.includes('node:')) {
        // Only flag if it looks like a direct fetch call, not a comment or import
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
          if (/\bfetch\s*\(/.test(trimmed) && !/import/.test(trimmed)) {
            violations.push(relFile);
            break;
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Encrypted DB/WAL verification
// ---------------------------------------------------------------------------

describe('encrypted storage', () => {
  const key = generateKey();

  it('encrypt/decrypt roundtrips correctly', () => {
    const plaintext = 'sensitive document AST payload with 中文内容';
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypt produces different ciphertext for same plaintext', () => {
    const plaintext = 'same text twice';
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    // Different IVs → different ciphertext
    expect(a.equals(b)).toBe(false);
  });

  it('decrypt with wrong key throws', () => {
    const encrypted = encrypt('secret', key);
    const wrongKey = generateKey();
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('decrypt with truncated payload throws', () => {
    const tooShort = Buffer.alloc(20); // < IV_LENGTH(12) + TAG_LENGTH(16) = 28
    expect(() => decrypt(tooShort, key)).toThrow(/Invalid encrypted payload/);
  });

  it('schema has encrypted BLOB columns', () => {
    const allSql = CREATE_TABLES_SQL.join('\n');
    expect(allSql).toContain('payload_encrypted BLOB');
    expect(allSql).toContain('note_encrypted BLOB');
  });

  it('WAL and foreign keys pragmas are defined', () => {
    expect(ENABLE_WAL_SQL).toContain('journal_mode = WAL');
    expect(ENABLE_FOREIGN_KEYS_SQL).toContain('foreign_keys = ON');
  });
});

// ---------------------------------------------------------------------------
// 3. Deletion closure — ON DELETE CASCADE
// ---------------------------------------------------------------------------

describe('deletion closure', () => {
  it('document_snapshots uses ON DELETE CASCADE', () => {
    const sql = CREATE_TABLES_SQL.find(s => s.includes('document_snapshots'));
    expect(sql).toBeDefined();
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('diff_snapshots uses ON DELETE CASCADE', () => {
    const sql = CREATE_TABLES_SQL.find(s => s.includes('diff_snapshots'));
    expect(sql).toBeDefined();
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('review_annotations uses ON DELETE CASCADE', () => {
    const sql = CREATE_TABLES_SQL.find(s => s.includes('review_annotations'));
    expect(sql).toBeDefined();
    expect(sql).toContain('ON DELETE CASCADE');
  });
});

/**
 * Log redaction verification — ensure main process never logs sensitive data.
 * Requirement: QA-03
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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

// Sensitive variable names that must never appear in log calls
const SENSITIVE_PATTERNS = [
  /\bmasterKey\b/,
  /\bencryptionKey\b/,
  /\bprivateKey\b/,
  /\bsecretKey\b/,
  /\bpassword\b/,
  /\bplaintext\b/,
  /\bsecret\b/,
];

const LOG_CALL_RE = /console\.(log|error|warn|info|debug)\s*\(/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('log redaction', () => {
  const tsFiles = walkTsFiles(MAIN_SRC_DIR);

  it('main process does not log encryption keys or sensitive variables', () => {
    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relFile = path.relative(MAIN_SRC_DIR, file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!LOG_CALL_RE.test(line)) continue;

        for (const pattern of SENSITIVE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({ file: relFile, line: i + 1, text: line.trim() });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('console.log calls do not log raw Buffer or key material', () => {
    const violations: Array<{ file: string; line: number }> = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relFile = path.relative(MAIN_SRC_DIR, file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!LOG_CALL_RE.test(line)) continue;

        // Flag logging of raw key/Buffer variables
        if (/console\.\w+\s*\(\s*(key|masterKey|encryptionKey|buf|buffer)\s*\)/.test(line)) {
          violations.push({ file: relFile, line: i + 1 });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

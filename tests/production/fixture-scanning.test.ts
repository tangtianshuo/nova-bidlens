/**
 * Production bundle fixture scanning tests.
 * Verifies the check-fixtures script correctly detects leaked test patterns.
 * Requirement: QA-07
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Replicated scanning logic from apps/desktop/scripts/check-fixtures.ts
// We test the core regex matching without needing a full Vite build.
// ---------------------------------------------------------------------------

interface Finding {
  file: string;
  pattern: string;
  line: number;
  snippet: string;
}

const FIXTURE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /proj-fixture-/g, label: 'test project ID (proj-fixture-*)' },
  { regex: /甲公司投标文件/g, label: 'test file name (甲公司投标文件)' },
  { regex: /乙公司投标文件/g, label: 'test file name (乙公司投标文件)' },
  { regex: /丙公司投标文件/g, label: 'test file name (丙公司投标文件)' },
  { regex: /__mocks__\//g, label: '__mocks__/ import' },
  { regex: /__fixtures__\//g, label: '__fixtures__/ import' },
  { regex: /test-utils/g, label: 'test-utils import' },
];

function scanDir(dir: string): Finding[] {
  const findings: Finding[] = [];
  if (!fs.existsSync(dir)) return findings;

  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|css|html|mjs|cjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        for (const { regex, label: patLabel } of FIXTURE_PATTERNS) {
          regex.lastIndex = 0;
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              findings.push({
                file: path.relative(dir, full),
                pattern: patLabel,
                line: i + 1,
                snippet: lines[i].trim().slice(0, 120),
              });
            }
            regex.lastIndex = 0;
          }
        }
      }
    }
  };

  walk(dir);
  return findings;
}

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bidlens-fixture-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fixture scanner', () => {
  it('scanner detects test project ID pattern', () => {
    const dir = path.join(tmpDir, 'detect-proj');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'const id = "proj-fixture-abc123";');

    const findings = scanDir(dir);
    expect(findings.some(f => f.pattern.includes('proj-fixture'))).toBe(true);
  });

  it('scanner detects __fixtures__/ import', () => {
    const dir = path.join(tmpDir, 'detect-fixtures');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'import data from "__fixtures__/sample.json";');

    const findings = scanDir(dir);
    expect(findings.some(f => f.pattern.includes('__fixtures__'))).toBe(true);
  });

  it('scanner detects Chinese test file names', () => {
    const dir = path.join(tmpDir, 'detect-chinese');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'const name = "甲公司投标文件";');

    const findings = scanDir(dir);
    expect(findings.some(f => f.pattern.includes('甲公司投标文件'))).toBe(true);
  });

  it('scanner detects __mocks__/ import', () => {
    const dir = path.join(tmpDir, 'detect-mocks');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'jest.mock("__mocks__/electron");');

    const findings = scanDir(dir);
    expect(findings.some(f => f.pattern.includes('__mocks__'))).toBe(true);
  });

  it('scanner passes for clean files', () => {
    const dir = path.join(tmpDir, 'clean');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'), 'const x = 1; console.log(x);');
    fs.writeFileSync(path.join(dir, 'style.css'), 'body { margin: 0; }');

    const findings = scanDir(dir);
    expect(findings).toEqual([]);
  });

  it('scanner only checks .js/.css/.html/.mjs/.cjs files', () => {
    const dir = path.join(tmpDir, 'file-types');
    fs.mkdirSync(dir, { recursive: true });
    // .ts files should be ignored (not in production bundle)
    fs.writeFileSync(path.join(dir, 'app.ts'), 'const id = "proj-fixture-test";');
    // .js files should be scanned
    fs.writeFileSync(path.join(dir, 'app.js'), 'const x = 1;');

    const findings = scanDir(dir);
    expect(findings).toEqual([]);
  });

  it('defines at least 7 fixture patterns', () => {
    expect(FIXTURE_PATTERNS.length).toBeGreaterThanOrEqual(7);
  });

  it('check-fixtures.ts script exists and has expected patterns', () => {
    const scriptPath = path.resolve(__dirname, '../../apps/desktop/scripts/check-fixtures.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('FIXTURE_PATTERNS');
    expect(content).toContain('proj-fixture-');
    expect(content).toContain('甲公司投标文件');
    expect(content).toContain('__fixtures__');
    expect(content).toContain('__mocks__');
  });
});

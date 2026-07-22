/**
 * Build-time check: scan production bundles for leaked test fixtures.
 * Run after `vite build` to ensure no test data ends up in the packaged app.
 *
 * Usage: npx tsx scripts/check-fixtures.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const RENDERER_DIST = path.resolve(__dirname, '../dist/renderer');
const MAIN_DIST = path.resolve(__dirname, '../dist/main');

interface Finding {
  file: string;
  pattern: string;
  line: number;
  snippet: string;
}

const FIXTURE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // Test project IDs
  { regex: /proj-fixture-/g, label: 'test project ID (proj-fixture-*)' },
  // Test file names from corpus
  { regex: /甲公司投标文件/g, label: 'test file name (甲公司投标文件)' },
  { regex: /乙公司投标文件/g, label: 'test file name (乙公司投标文件)' },
  { regex: /丙公司投标文件/g, label: 'test file name (丙公司投标文件)' },
  // Mock/stub patterns
  { regex: /__mocks__\//g, label: '__mocks__/ import' },
  { regex: /__fixtures__\//g, label: '__fixtures__/ import' },
  { regex: /test-utils/g, label: 'test-utils import' },
];

function scanDir(dir: string, label: string): Finding[] {
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
          // Reset lastIndex for global regexes
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

function main() {
  let allFindings: Finding[] = [];

  console.log('Scanning renderer dist for leaked fixtures...');
  allFindings.push(...scanDir(RENDERER_DIST, 'renderer'));

  console.log('Scanning main process dist for leaked fixtures...');
  allFindings.push(...scanDir(MAIN_DIST, 'main'));

  if (allFindings.length > 0) {
    console.error('\n=== FIXTURE LEAK DETECTED ===\n');
    for (const f of allFindings) {
      console.error(`  ${f.file}:${f.line} — ${f.pattern}`);
      console.error(`    ${f.snippet}\n`);
    }
    console.error(`Total: ${allFindings.length} finding(s). Fix before shipping.`);
    process.exit(1);
  }

  console.log('OK — no test fixtures found in production bundles.');
}

main();

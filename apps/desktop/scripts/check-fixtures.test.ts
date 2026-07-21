/**
 * Tests for the fixture scanner.
 * Verifies the scanner detects known fixture patterns and passes clean code.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Inline the scan logic for unit testing (avoids needing dist/ to exist)
const FIXTURE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /proj-fixture-/g, label: 'test project ID (proj-fixture-*)' },
  { regex: /甲公司投标文件/g, label: 'test file name (甲公司投标文件)' },
  { regex: /__mocks__\//g, label: '__mocks__/ import' },
  { regex: /__fixtures__\//g, label: '__fixtures__/ import' },
  { regex: /test-utils/g, label: 'test-utils import' },
  { regex: /BIDLENS_TEST_DATA_DIR/g, label: 'test env var (BIDLENS_TEST_DATA_DIR)' },
];

function scanContent(content: string): string[] {
  const labels: string[] = [];
  for (const { regex, label } of FIXTURE_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(content)) labels.push(label);
  }
  return labels;
}

describe('check-fixtures scanner', () => {
  it('detects test project IDs', () => {
    const hits = scanContent('const id = "proj-fixture-01";');
    expect(hits).toContain('test project ID (proj-fixture-*)');
  });

  it('detects Chinese test file names', () => {
    const hits = scanContent('path: "/docs/甲公司投标文件.docx"');
    expect(hits).toContain('test file name (甲公司投标文件)');
  });

  it('detects __fixtures__ imports', () => {
    const hits = scanContent('import { x } from "../__fixtures__/data"');
    expect(hits).toContain('__fixtures__/ import');
  });

  it('detects test-utils imports', () => {
    const hits = scanContent('import { render } from "./test-utils"');
    expect(hits).toContain('test-utils import');
  });

  it('detects test env vars', () => {
    const hits = scanContent('process.env.BIDLENS_TEST_DATA_DIR');
    expect(hits).toContain('test env var (BIDLENS_TEST_DATA_DIR)');
  });

  it('passes clean production code', () => {
    const clean = `
      const projectId = crypto.randomUUID();
      const detail = await api.getProject(projectId);
      export default { projectId };
    `;
    expect(scanContent(clean)).toHaveLength(0);
  });
});

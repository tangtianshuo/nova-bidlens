import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

import { BIDLENS_VERSION } from './index';

describe('BIDLENS_VERSION', () => {
  it('matches the workspace package version', () => {
    expect(BIDLENS_VERSION).toBe('0.1.0');
  });
});

describe('shared package barrel', () => {
  it('uses runtime-resolvable ESM specifiers in source imports and exports', () => {
    const sourceFiles = readdirSync(new URL('.', import.meta.url))
      .filter((filename) => filename.endsWith('.ts') && !filename.endsWith('.test.ts'));
    const specifiers = sourceFiles.flatMap((filename) => {
      const source = readFileSync(new URL(filename, import.meta.url), 'utf8');
      return [...source.matchAll(/(?:import|export)(?: type)?(?: \{[^}]*\})?[^'"]* from ['"](\.\/[^'"]+)['"]/g)]
        .map((match) => match[1]);
    });

    expect(specifiers).not.toHaveLength(0);
    expect(specifiers.every((specifier) => specifier.endsWith('.js'))).toBe(true);
  });
});

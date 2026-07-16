import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { BIDLENS_VERSION } from './index';

describe('BIDLENS_VERSION', () => {
  it('matches the workspace package version', () => {
    expect(BIDLENS_VERSION).toBe('0.1.0');
  });
});

describe('shared package barrel', () => {
  it('uses runtime-resolvable ESM specifiers', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const exportSpecifiers = [...source.matchAll(/export \* from '(\.\/[^']+)'/g)].map((match) => match[1]);

    expect(exportSpecifiers).not.toHaveLength(0);
    expect(exportSpecifiers.every((specifier) => specifier.endsWith('.js'))).toBe(true);
  });
});

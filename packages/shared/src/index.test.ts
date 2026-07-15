import { describe, expect, it } from 'vitest';

import { BIDLENS_VERSION } from './index';

describe('BIDLENS_VERSION', () => {
  it('matches the workspace package version', () => {
    expect(BIDLENS_VERSION).toBe('0.1.0');
  });
});

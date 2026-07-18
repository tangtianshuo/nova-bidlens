/**
 * P6-08: Tests for version synchronization and compatibility.
 */

import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  PROTOCOL_VERSION,
  SNAPSHOT_VERSION,
  REPORT_VERSION,
  getBuildMetadata,
  checkProtocolCompatibility,
  checkSnapshotCompatibility,
  formatVersionForDisplay,
  formatVersionForHeaders,
  getVersionBanner,
  LICENSE_INFO,
} from './version';

describe('Version Module', () => {
  describe('Version Constants', () => {
    it('has valid app version', () => {
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('has valid protocol version', () => {
      expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+$/);
    });

    it('has valid snapshot version', () => {
      expect(parseInt(SNAPSHOT_VERSION)).toBeGreaterThan(0);
    });

    it('has valid report version', () => {
      expect(REPORT_VERSION).toMatch(/^\d+\.\d+$/);
    });
  });

  describe('Build Metadata', () => {
    it('returns valid build metadata', () => {
      const meta = getBuildMetadata();

      expect(meta.version).toBe(APP_VERSION);
      expect(meta.buildDate).toBeDefined();
      expect(new Date(meta.buildDate).getTime()).not.toBeNaN();
      expect(meta.nodeVersion).toBeDefined();
      expect(meta.platform).toBeDefined();
      expect(meta.arch).toBeDefined();
    });
  });

  describe('Protocol Compatibility', () => {
    it('accepts matching major versions', () => {
      const result = checkProtocolCompatibility('2.0', '2.0');
      expect(result.compatible).toBe(true);
    });

    it('accepts compatible minor versions', () => {
      const result = checkProtocolCompatibility('2.0', '2.1');
      expect(result.compatible).toBe(true);
    });

    it('rejects mismatched major versions', () => {
      const result = checkProtocolCompatibility('1.0', '2.0');
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('upgrade');
    });

    it('rejects newer client major version', () => {
      const result = checkProtocolCompatibility('3.0', '2.0');
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('downgrade');
    });
  });

  describe('Snapshot Compatibility', () => {
    it('accepts current snapshot version', () => {
      const result = checkSnapshotCompatibility(SNAPSHOT_VERSION);
      expect(result.compatible).toBe(true);
    });

    it('accepts previous snapshot version', () => {
      const prevVersion = String(parseInt(SNAPSHOT_VERSION) - 1);
      const result = checkSnapshotCompatibility(prevVersion);
      expect(result.compatible).toBe(true);
    });

    it('rejects too-new snapshot version', () => {
      const futureVersion = String(parseInt(SNAPSHOT_VERSION) + 1);
      const result = checkSnapshotCompatibility(futureVersion);
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('upgrade');
    });

    it('rejects too-old snapshot version', () => {
      const result = checkSnapshotCompatibility('0');
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('reject');
    });
  });

  describe('Version Formatting', () => {
    it('formats version for display', () => {
      const display = formatVersionForDisplay();
      expect(display).toBe(`v${APP_VERSION}`);
    });

    it('formats version for headers', () => {
      const header = formatVersionForHeaders();
      expect(header).toContain(`BidLens/${APP_VERSION}`);
    });

    it('generates version banner', () => {
      const banner = getVersionBanner();
      expect(banner).toContain(APP_VERSION);
      expect(banner).toContain('BidLens');
    });
  });

  describe('License Info', () => {
    it('has app license info', () => {
      expect(LICENSE_INFO.app).toBe('BidLens');
      expect(LICENSE_INFO.version).toBe(APP_VERSION);
      expect(LICENSE_INFO.license).toBeDefined();
      expect(LICENSE_INFO.copyright).toBeDefined();
    });

    it('has third-party licenses', () => {
      expect(LICENSE_INFO.thirdParty.length).toBeGreaterThan(0);

      for (const lib of LICENSE_INFO.thirdParty) {
        expect(lib.name).toBeDefined();
        expect(lib.license).toBeDefined();
        expect(lib.url).toBeDefined();
      }
    });
  });
});

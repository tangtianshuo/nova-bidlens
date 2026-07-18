/**
 * P6-08: Product version synchronization and manifest.
 *
 * Centralizes version information across:
 * - Electron app (package.json)
 * - Shared package
 * - Rust engine
 * - IPC handshake
 * - Reports
 * - File metadata
 */

// ---------------------------------------------------------------------------
// Version constants
// ---------------------------------------------------------------------------

/** Application version - synchronized across all packages */
export const APP_VERSION = '0.2.2';

/** Protocol version for IPC communication */
export const PROTOCOL_VERSION = '2.0';

/** Snapshot version for persistence format */
export const SNAPSHOT_VERSION = '2';

/** Report format version */
export const REPORT_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Build metadata
// ---------------------------------------------------------------------------

export interface BuildMetadata {
  version: string;
  buildDate: string;
  gitCommit?: string;
  gitBranch?: string;
  nodeVersion: string;
  electronVersion?: string;
  rustEngineVersion?: string;
  platform: string;
  arch: string;
}

/**
 * Get build metadata for the current environment.
 * In production, this would be populated at build time.
 */
export function getBuildMetadata(): BuildMetadata {
  return {
    version: APP_VERSION,
    buildDate: new Date().toISOString(),
    nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
    platform: typeof process !== 'undefined' ? process.platform : 'unknown',
    arch: typeof process !== 'undefined' ? process.arch : 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Version compatibility
// ---------------------------------------------------------------------------

export interface VersionCompatibility {
  compatible: boolean;
  reason?: string;
  action?: 'proceed' | 'upgrade' | 'downgrade' | 'reject';
}

/**
 * Check if two protocol versions are compatible.
 */
export function checkProtocolCompatibility(
  clientVersion: string,
  serverVersion: string
): VersionCompatibility {
  const clientMajor = parseInt(clientVersion.split('.')[0]);
  const serverMajor = parseInt(serverVersion.split('.')[0]);

  if (clientMajor !== serverMajor) {
    return {
      compatible: false,
      reason: `协议版本不兼容: 客户端 ${clientVersion}, 服务端 ${serverVersion}`,
      action: clientMajor < serverMajor ? 'upgrade' : 'downgrade',
    };
  }

  return { compatible: true };
}

/**
 * Check if a snapshot version can be read by the current code.
 */
export function checkSnapshotCompatibility(snapshotVersion: string): VersionCompatibility {
  const snapshot = parseInt(snapshotVersion);
  const current = parseInt(SNAPSHOT_VERSION);

  if (snapshot > current) {
    return {
      compatible: false,
      reason: `快照版本 ${snapshotVersion} 高于当前支持的版本 ${SNAPSHOT_VERSION}`,
      action: 'upgrade',
    };
  }

  if (snapshot < current - 1) {
    return {
      compatible: false,
      reason: `快照版本 ${snapshotVersion} 过旧，需要迁移`,
      action: 'reject',
    };
  }

  return { compatible: true };
}

// ---------------------------------------------------------------------------
// License and attribution
// ---------------------------------------------------------------------------

export const LICENSE_INFO = {
  app: 'BidLens',
  version: APP_VERSION,
  license: 'Proprietary',
  copyright: 'Copyright © 2026 Nova. All rights reserved.',
  thirdParty: [
    {
      name: 'Electron',
      license: 'MIT',
      url: 'https://github.com/electron/electron',
    },
    {
      name: 'React',
      license: 'MIT',
      url: 'https://github.com/facebook/react',
    },
    {
      name: 'better-sqlite3',
      license: 'MIT',
      url: 'https://github.com/WiseLibs/better-sqlite3',
    },
    {
      name: 'Tailwind CSS',
      license: 'MIT',
      url: 'https://github.com/tailwindlabs/tailwindcss',
    },
    {
      name: 'Radix UI',
      license: 'MIT',
      url: 'https://github.com/radix-ui/primitives',
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Version string formatting
// ---------------------------------------------------------------------------

/**
 * Format version for display in UI.
 */
export function formatVersionForDisplay(): string {
  return `v${APP_VERSION}`;
}

/**
 * Format version for user-agent or headers.
 */
export function formatVersionForHeaders(): string {
  const meta = getBuildMetadata();
  return `BidLens/${APP_VERSION} (${meta.platform}; ${meta.arch})`;
}

/**
 * Get version banner for console/logs.
 */
export function getVersionBanner(): string {
  return `
╔══════════════════════════════════════════╗
║           BidLens v${APP_VERSION}              ║
║    招标文档语义比对工具                    ║
╚══════════════════════════════════════════╝
`.trim();
}

import { createRequire } from 'node:module';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';

type DatabaseConstructor = typeof BetterSqlite3;

/** Load the native database module from its explicit packaged location. */
export function loadNativeDatabase(nativeModulesRoot?: string): DatabaseConstructor {
  if (nativeModulesRoot) {
    const resourceRequire = createRequire(path.join(nativeModulesRoot, 'package.json'));
    return resourceRequire('better-sqlite3') as DatabaseConstructor;
  }
  return require('better-sqlite3') as DatabaseConstructor;
}

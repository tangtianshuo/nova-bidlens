const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const appDir = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(appDir, 'package.json'));

function packageDirectory(packageName, requireFrom = appRequire) {
  return path.dirname(requireFrom.resolve(`${packageName}/package.json`));
}

module.exports = async function copyNativeRuntime(context) {
  const outputDir = path.join(context.appOutDir, 'resources', 'native');
  const sqliteDir = packageDirectory('better-sqlite3');
  const sqliteRequire = createRequire(path.join(sqliteDir, 'package.json'));
  const bindingsDir = packageDirectory('bindings', sqliteRequire);
  const bindingsRequire = createRequire(path.join(bindingsDir, 'package.json'));

  fs.rmSync(outputDir, { recursive: true, force: true });

  const packages = [
    ['better-sqlite3', sqliteDir],
    ['bindings', bindingsDir],
    ['file-uri-to-path', packageDirectory('file-uri-to-path', bindingsRequire)],
  ];
  for (const [packageName, sourceDir] of packages) {
    fs.cpSync(sourceDir, path.join(outputDir, 'node_modules', packageName), {
      recursive: true,
      dereference: true,
    });
  }

  const nativeBinding = path.join(
    outputDir,
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );
  if (!fs.existsSync(nativeBinding)) {
    throw new Error(`Native better-sqlite3 binding is missing: ${nativeBinding}`);
  }

  console.log(`[native-runtime] Copied Electron native modules to ${outputDir}`);
};

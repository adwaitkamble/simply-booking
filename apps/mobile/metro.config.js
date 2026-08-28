// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (needed for @hotel-pms/types workspace package)
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. CRITICAL: Disable package "exports" field resolution.
//    socket.io-client and engine.io-client declare an "exports" map that points
//    to raw ESM builds (import/export syntax). Hermes in a standalone APK cannot
//    execute untransformed ESM. Disabling this makes Metro fall back to the "main"
//    field which points to the safe CJS build for every package.
config.resolver.unstable_enablePackageExports = false;

// 4. Block server-side workspaces from being accidentally bundled into the mobile app.
//    The apps/api and packages/database directories contain Node.js-only code
//    (Prisma, Express, etc.) that will crash the React Native bundler if traversed.
config.resolver.blockList = [
  /.*\/apps\/api\/.*/,
  /.*\/packages\/database\/.*/,
];

module.exports = config;

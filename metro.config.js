// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = __dirname; // root IS the monorepo root

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, 'apps/mobile/node_modules'),
];

// 3. Disable package "exports" field resolution so Hermes receives safe CJS builds
config.resolver.unstable_enablePackageExports = false;

// 4. Block server-side workspaces from being accidentally bundled into the mobile app
config.resolver.blockList = [
  /.*\/apps\/api\/.*/,
  /.*\/packages\/database\/.*/,
];

module.exports = config;

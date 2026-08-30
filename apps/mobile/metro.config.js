// Metro config for this Bun monorepo. Without it, Metro resolves react-native from a
// nested .bun/ copy (breaking web bundling with "./rn-get-polyfills not exported").
// Watch the workspace root and pin resolution to the app's + root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Keep hierarchical lookup ON so Metro can still find Bun's nested/.bun transitive deps.

// Pin core packages to the app's single copy. Under Bun's .bun store, @expo/cli's
// serializer otherwise resolves react-native from its own nested copy (which lacks
// the ./rn-get-polyfills export), breaking web bundling. Force one canonical copy.
const rn = path.resolve(projectRoot, "node_modules/react-native");
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "react-native": rn,
  react: path.resolve(projectRoot, "node_modules/react"),
};

module.exports = config;

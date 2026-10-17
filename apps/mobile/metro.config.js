// Expo's default Metro setup already understands pnpm/Turborepo monorepos
// (it watches the repo root and resolves our workspace packages).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);

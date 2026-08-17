const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix nanoid: prefer browser build (uses Web Crypto) over Node crypto build
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Alias form-data to RN's built-in global FormData
// (the npm form-data package uses Node streams which don't exist in RN)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'form-data': require.resolve('./shims/form-data-rn-shim.js'),
};

module.exports = config;
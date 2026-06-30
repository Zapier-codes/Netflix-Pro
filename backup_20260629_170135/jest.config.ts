module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['@testing-library/react-native'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.styles.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo|react-native-vector-icons|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|@react-native-async-storage|@react-native-community|react-native-webview|react-native-svg|expo-*)',
  ],
};

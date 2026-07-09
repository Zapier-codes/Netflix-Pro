const packageJson = require('./package.json');
const IS_DEV = process.env.APP_VARIANT === 'development';

console.log('[CONFIG] Loading app.config.ts...');
console.log('[CONFIG] IS_DEV:', IS_DEV);
console.log('[CONFIG] Package version:', packageJson.version);

export default {
  expo: {
    name: IS_DEV ? "Netflix Pro (Dev)" : "Netflix Pro",
    slug: "netflix-pro",
    scheme: IS_DEV ? "netflixpro-dev" : "netflixpro",
    version: packageJson.version,
    orientation: "default",
    icon: IS_DEV ? "./assets/icon-dev.png" : "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    platforms: ["android"],
    entryPoint: "./App.tsx",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#141414"
    },
    android: {
      versionCode: packageJson["version-iteration"],
      versionName: packageJson.version,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#141414"
      },
      package: IS_DEV ? "com.netflixpro.dev" : "com.netflixpro.app",
      permissions: [
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.SET_ORIENTATION",
        "android.permission.WRITE_SETTINGS"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      name: "Netflix Pro"
    },
    plugins: [
      "expo-font",
      "expo-screen-orientation",
      ["expo-video", {
        "supportsBackgroundPlayback": true,
        "supportsPictureInPicture": true
      }],
      "expo-secure-store",
      "expo-background-task"
    ],
    assetBundlePatterns: ["**/*"],
    owner: "Zapier-codes",
    extra: {
      buildDate: new Date().toISOString()
    }
  }
};
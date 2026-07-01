import { Platform } from 'react-native';
// Adjust this import path if your Pawns JS wrapper lives elsewhere.
import { initialize as initializePawnsSdk } from '../../modules/pawns';

/**
 * IMPORTANT: Expo only inlines env vars prefixed with EXPO_PUBLIC_ into the
 * JS bundle. Plain process.env.PAWNS_API_KEY (no prefix) is undefined at
 * runtime in app code — only app.config.ts (Node, build time) can read
 * unprefixed vars. Your .env key must be named EXPO_PUBLIC_PAWNS_API_KEY.
 */
const PAWNS_API_KEY = process.env.EXPO_PUBLIC_PAWNS_API_KEY;

/**
 * Initializes the Pawns SDK automatically on app start.
 * Consent is auto-granted and sharing auto-starts on the native side
 * (see PawnsModule.kt) — no consent screen, no separate optIn() call needed.
 *
 * Android-only: the native Pawns module has no iOS implementation.
 *
 * Note: on a fresh install, this only runs once the user opens the app for
 * the first time (Android won't deliver BOOT_COMPLETED to a never-launched
 * app — OS restriction, not something this code controls). Once that first
 * open has happened, PawnsBootReceiver restarts sharing automatically on
 * every subsequent boot with no further app opens needed.
 */
export async function initializePawns(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('[Pawns] Skipping init — Android only');
    return;
  }
  if (!PAWNS_API_KEY) {
    console.warn(
      '[Pawns] No API key found (expected EXPO_PUBLIC_PAWNS_API_KEY) — skipping init'
    );
    return;
  }
  try {
    const result = await initializePawnsSdk(PAWNS_API_KEY);
    console.log('[Pawns] Initialized:', result);
  } catch (e) {
    console.error('[Pawns] Initialization failed:', e);
  }
}
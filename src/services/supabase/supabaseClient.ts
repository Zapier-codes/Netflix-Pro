// src/services/supabase/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: Expo/Metro only inlines env vars into the client bundle when
// they're prefixed with EXPO_PUBLIC_ (see app/_layout.tsx's use of
// EXPO_PUBLIC_PAWNS_API_KEY for the same pattern). A bare `SUPABASE_URL`
// or `SUPABASE_ANON_KEY` is undefined at runtime on device, which silently
// falls back to the placeholder values below — pointing the app at a
// nonexistent domain with a fake key on every request.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[supabaseClient] Missing EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Add them to your .env file (and app.config.js/eas.json env if building with EAS), ' +
    'then restart Metro with a cleared cache (`npx expo start -c`). ' +
    'All Supabase calls will fail until this is set.'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY || 'your-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export default supabase;
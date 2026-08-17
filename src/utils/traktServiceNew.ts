// src/utils/traktServiceNew.ts
import { getTraktService } from '../services/unified/social/TraktService';

// Use environment variable or default
const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || 'YOUR_CLIENT_ID';

export const traktService = getTraktService(TRAKT_CLIENT_ID);

export default traktService;
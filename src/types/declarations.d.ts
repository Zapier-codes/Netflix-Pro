// src/types/declarations.d.ts
declare module 'parse-srt' {
  const parseSRT: (content: string) => Array<{ start: number; end: number; text: string }>;
  export default parseSRT;
}

declare module '*.mp4' {
  const content: string;
  export default content;
}

declare module '@env' {
  export const TMDB_API_KEY: string;
  export const OPENSUBTITLES_API_KEY: string;
}

declare module 'react-native-vector-icons/Ionicons';
declare module 'react-native-vector-icons/MaterialIcons';
declare module 'react-native-vector-icons/Feather';
declare module 'react-native-vector-icons/EvilIcons';

// palash-ffmpeg-kit-react-native-sf ships a bundled .d.ts (src/index.d.ts)
// that declares itself as module 'ffmpeg-kit-react-native' — the name of
// the package it was forked from — instead of its own published name.
// TS can't match `import ... from 'palash-ffmpeg-kit-react-native-sf'`
// against that ambient declaration, so re-export everything under the
// name actually used in this repo's imports.
declare module 'palash-ffmpeg-kit-react-native-sf' {
  export * from 'ffmpeg-kit-react-native';
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

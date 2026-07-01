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

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

// src/types/index.ts
export interface MediaItem {
  id: string | number;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  mediaType?: 'movie' | 'tv' | 'sport';
}

export interface VideoSource {
  url: string;
  quality?: string;
  type?: 'hls' | 'mp4' | 'dash';
  headers?: Record<string, string>;
}

export interface SubtitleTrack {
  url: string;
  language: string;
  code: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  url: string;
  localPath?: string;
  size?: number;
}

export interface StreamSource {
  url: string;
  quality: string;
  format: string;
  headers?: Record<string, string>;
}

export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  overview?: string;
  stillPath?: string;
}

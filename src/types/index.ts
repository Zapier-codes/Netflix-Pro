// src/types/index.ts
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  release_date: string;
  genre_ids: number[];
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  genre_ids: number[];
}

export interface StreamSource {
  name: string;
  url: string;
  quality: string;
  referer?: string;
}

export interface ContentRow {
  id: string;
  title: string;
  type: 'trending' | 'top_rated' | 'popular' | 'upcoming' | 'now_playing' | 'genre';
  content: (Movie | TVShow)[];
}

export interface DownloadItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  posterPath: string;
  progress: number;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

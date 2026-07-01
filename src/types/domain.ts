// src/types/domain.ts
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
  media_type?: 'movie';
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
  media_type?: 'tv';
}

export interface Drama {
  id: string;
  title: string;
  synopsis: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  country: string;
  year: number;
  totalEpisodes: number;
  status: 'Ongoing' | 'Completed';
  source: 'xyra' | 'kuryana';
}

export interface StreamSource {
  name: string;
  url: string;
  quality: string;
  format: 'hls' | 'dash' | 'mp4';
  provider: 'consumet' | 'xyra' | 'vidsrc';
  referer?: string;
  subtitles?: Subtitle[];
}

export interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  provider: 'opensubtitles' | 'subdl';
  rating?: number;
}

export interface Review {
  id: string;
  username: string;
  avatar?: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv' | 'drama';
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

export interface DeviceProfile {
  id: string;
  name: string;
  avatar: string;
  emoji: string;
  createdAt: string;
  lastActive: string;
}

export interface ContentRow {
  id: string;
  title: string;
  type: 'trending' | 'top_rated' | 'popular' | 'upcoming' | 'now_playing' | 'genre' | 'drama' | 'anime';
  content: (Movie | TVShow | Drama)[];
}

export interface LiveViewerCount {
  contentId: string;
  viewers: number;
  trend: 'up' | 'down' | 'stable';
  peakViewers: number;
  seededAt: string;
}

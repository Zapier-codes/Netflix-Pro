// src/api/tmdbApi.ts
import axios from 'axios';

const TMDB_API_KEY = 'fa953c513c37da857fb3155738358ff0';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const HIGH_RES_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// Define popular US providers (Netflix, Prime Video, Hulu, Disney+, Max)
const US_PROVIDERS_STRING = '8|9|15|337|1899';
const US_REGION = 'US';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to create standard image URLs
export const getImageUrl = (path: string | null, size?: string) => {
  if (!path) return null;
  return `${IMAGE_BASE_URL}${path}`;
};

// Helper function to create high-resolution image URLs
export const getHighResImageUrl = (path: string | null) => {
  if (!path) return null;
  return `${HIGH_RES_IMAGE_BASE_URL}${path}`;
};

// ──────────────────────────────────────────────────────────────────────────
// TRENDING
// ──────────────────────────────────────────────────────────────────────────

export const fetchTrending = async (
  timeWindow: 'day' | 'week' = 'day',
  mediaType: 'all' | 'movie' | 'tv' = 'all'
): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/trending/${mediaType}/${timeWindow}`, {
      params: { api_key: TMDB_API_KEY }
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// POPULAR
// ──────────────────────────────────────────────────────────────────────────

export const fetchPopularMovies = async (): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        include_adult: false,
        'primary_release_date.lte': getTodayDateString(),
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
};

export const fetchPopularTVShows = async (): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/discover/tv`, {
      params: {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        include_adult: false,
        'first_air_date.lte': getTodayDateString(),
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching popular TV shows:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// TOP RATED
// ──────────────────────────────────────────────────────────────────────────

export const fetchTopRatedMovies = async ({ page = 1 }: { page?: number } = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/top_rated`, {
      params: { api_key: TMDB_API_KEY, page }
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching top rated movies:', error);
    return [];
  }
};

export const fetchTopRatedTVShows = async ({ page = 1 }: { page?: number } = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/top_rated`, {
      params: { api_key: TMDB_API_KEY, page }
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching top rated TV shows:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// NEW RELEASES
// ──────────────────────────────────────────────────────────────────────────

export const fetchNewReleaseMovies = async (): Promise<any[]> => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const today = new Date();

    const formattedOneMonthAgo = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const response = await axios.get(`${BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        include_adult: false,
        'primary_release_date.gte': formattedOneMonthAgo,
        'primary_release_date.lte': formattedToday,
        sort_by: 'popularity.desc',
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching new release movies:', error);
    return [];
  }
};

export const fetchNewReleaseTVShows = async (): Promise<any[]> => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const today = new Date();

    const formattedOneMonthAgo = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, '0')}-${String(oneMonthAgo.getDate()).padStart(2, '0')}`;
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const response = await axios.get(`${BASE_URL}/discover/tv`, {
      params: {
        api_key: TMDB_API_KEY,
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        include_adult: false,
        'first_air_date.gte': formattedOneMonthAgo,
        'first_air_date.lte': formattedToday,
        sort_by: 'popularity.desc',
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching new release TV shows:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// UPCOMING / AIRING
// ──────────────────────────────────────────────────────────────────────────

export const fetchUpcomingMovies = async ({ page = 1 }: { page?: number } = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/upcoming`, {
      params: { api_key: TMDB_API_KEY, page }
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return [];
  }
};

export const fetchAiringTodayTV = async ({ page = 1 }: { page?: number } = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/airing_today`, {
      params: { api_key: TMDB_API_KEY, page }
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching airing today TV shows:', error);
    return [];
  }
};

export const fetchOnTheAirTV = async ({ page = 1 }: { page?: number } = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/on_the_air`, {
      params: { api_key: TMDB_API_KEY, page }
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching on the air TV shows:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ──────────────────────────────────────────────────────────────────────────

export const fetchRecommendedMovies = async (params: any = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        include_adult: false,
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        'primary_release_date.lte': getTodayDateString(),
        ...params
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching recommended movies:', error);
    return [];
  }
};

export const fetchRecommendedTVShows = async (params: any = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/discover/tv`, {
      params: {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        include_adult: false,
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        'first_air_date.lte': getTodayDateString(),
        ...params
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching recommended TV shows:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// DETAILS
// ──────────────────────────────────────────────────────────────────────────

export const fetchMovieDetails = async (movieId: number): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/${movieId}`, {
      params: { api_key: TMDB_API_KEY, append_to_response: 'credits,videos' },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching movie details:', error);
    throw error;
  }
};

export const fetchTVShowDetails = async (tvId: number): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/${tvId}`, {
      params: { api_key: TMDB_API_KEY, append_to_response: 'credits,videos' },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    throw error;
  }
};

export const fetchSeasonDetails = async (tvId: number, seasonNumber: number): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching season details:', error);
    throw error;
  }
};

export const fetchMovieRecommendations = async (movieId: number): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/${movieId}/recommendations`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching movie recommendations:', error);
    return [];
  }
};

export const fetchTVShowRecommendations = async (tvId: number): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/${tvId}/recommendations`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error fetching TV show recommendations:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// VIDEOS (TRAILERS) - ADDED THIS SECTION
// ──────────────────────────────────────────────────────────────────────────

export const fetchMovieVideos = async (movieId: number): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/${movieId}/videos`, {
      params: { api_key: TMDB_API_KEY }
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching movie videos:', error);
    return [];
  }
};

export const fetchTVVideos = async (tvId: number): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/tv/${tvId}/videos`, {
      params: { api_key: TMDB_API_KEY }
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching TV videos:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// GENRE
// ──────────────────────────────────────────────────────────────────────────

export const fetchMediaByGenre = async (mediaType: 'movie' | 'tv', genreId: number, params: any = {}): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/discover/${mediaType}`, {
      params: {
        api_key: TMDB_API_KEY,
        sort_by: 'popularity.desc',
        include_adult: false,
        watch_region: US_REGION,
        with_watch_providers: US_PROVIDERS_STRING,
        with_genres: genreId,
        ...(mediaType === 'movie' && { 'primary_release_date.lte': getTodayDateString() }),
        ...(mediaType === 'tv' && { 'first_air_date.lte': getTodayDateString() }),
        ...params,
      },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error(`Error fetching ${mediaType} by genre ${genreId}:`, error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// SEARCH
// ──────────────────────────────────────────────────────────────────────────

export const searchMedia = async (query: string): Promise<any[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/search/multi`, {
      params: { api_key: TMDB_API_KEY, query, include_adult: false },
    });
    return response.data.results?.filter((item: any) => item.poster_path) || [];
  } catch (error) {
    console.error('Error searching media:', error);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT
// ──────────────────────────────────────────────────────────────────────────

export default {
  // Trending
  fetchTrending,
  // Popular
  fetchPopularMovies,
  fetchPopularTVShows,
  // Top Rated
  fetchTopRatedMovies,
  fetchTopRatedTVShows,
  // New Releases
  fetchNewReleaseMovies,
  fetchNewReleaseTVShows,
  // Upcoming / Airing
  fetchUpcomingMovies,
  fetchAiringTodayTV,
  fetchOnTheAirTV,
  // Recommendations
  fetchRecommendedMovies,
  fetchRecommendedTVShows,
  // Details
  fetchMovieDetails,
  fetchTVShowDetails,
  fetchSeasonDetails,
  fetchMovieRecommendations,
  fetchTVShowRecommendations,
  // Videos (Trailers)
  fetchMovieVideos,
  fetchTVVideos,
  // Genre
  fetchMediaByGenre,
  // Search
  searchMedia,
  // Images
  getImageUrl,
  getHighResImageUrl,
};
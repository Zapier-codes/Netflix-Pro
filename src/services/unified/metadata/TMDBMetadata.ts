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

/**
 * FETCH TV SHOW DETAILS - UPDATED with seasons in append_to_response
 * 
 * This is the CRITICAL change for TV show season data.
 * The 'seasons' append_to_response ensures we get the full seasons array
 * which contains season_number, episode_count, air_date, name, overview, poster_path.
 * 
 * Without this, we only get basic TV show data without season information.
 */
export const fetchTVShowDetails = async (tvId: number): Promise<any> => {
  try {
    console.log(`[TMDBMetadata] 📡 Fetching TV show details for ID: ${tvId}`);
    
    const response = await axios.get(`${BASE_URL}/tv/${tvId}`, {
      params: { 
        api_key: TMDB_API_KEY, 
        // CRITICAL: Added 'seasons' to append_to_response
        // This returns the full seasons array with all season data
        append_to_response: 'credits,videos,seasons' 
      },
    });
    
    const data = response.data;
    
    // Log season data for debugging
    if (data.seasons) {
      console.log(`[TMDBMetadata] ✅ Found ${data.seasons.length} seasons for "${data.name}"`);
      const displaySeasons = data.seasons
        .filter((s: any) => s.season_number > 0 && s.air_date)
        .map((s: any) => s.season_number)
        .sort((a: number, b: number) => a - b);
      console.log(`[TMDBMetadata] 📊 Display seasons: [${displaySeasons.join(', ')}]`);
      console.log(`[TMDBMetadata] 📊 Total seasons: ${data.number_of_seasons || 0}`);
      console.log(`[TMDBMetadata] 📊 Total episodes: ${data.number_of_episodes || 0}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    throw error;
  }
};

/**
 * Fetch TV show details with explicit season data
 * This is a convenience wrapper that ensures we get the seasons data
 */
export const fetchTVShowDetailsWithSeasons = async (tvId: number): Promise<any> => {
  return fetchTVShowDetails(tvId);
};

export const fetchSeasonDetails = async (tvId: number, seasonNumber: number): Promise<any> => {
  try {
    console.log(`[TMDBMetadata] 📡 Fetching season ${seasonNumber} details for TV ID: ${tvId}`);
    
    const response = await axios.get(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}`, {
      params: { 
        api_key: TMDB_API_KEY,
        // Include episode details with full data
        append_to_response: 'credits,videos' 
      },
    });
    
    const data = response.data;
    
    if (data.episodes) {
      console.log(`[TMDBMetadata] ✅ Found ${data.episodes.length} episodes in season ${seasonNumber}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} details:`, error);
    throw error;
  }
};

/**
 * Batch fetch season details for multiple seasons
 * Useful for preloading multiple seasons at once
 */
export const fetchMultipleSeasonDetails = async (
  tvId: number, 
  seasonNumbers: number[]
): Promise<Record<number, any>> => {
  try {
    console.log(`[TMDBMetadata] 📡 Batch fetching ${seasonNumbers.length} seasons for TV ID: ${tvId}`);
    
    const results: Record<number, any> = {};
    const promises = seasonNumbers.map(async (seasonNum) => {
      try {
        const data = await fetchSeasonDetails(tvId, seasonNum);
        results[seasonNum] = data;
      } catch (error) {
        console.error(`[TMDBMetadata] ❌ Failed to fetch season ${seasonNum}:`, error);
        results[seasonNum] = null;
      }
    });
    
    await Promise.all(promises);
    console.log(`[TMDBMetadata] ✅ Batch fetched ${Object.keys(results).length} seasons`);
    return results;
  } catch (error) {
    console.error('Error batch fetching season details:', error);
    return {};
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
// VIDEOS (TRAILERS)
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
// REVIEWS (ADDED)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetch movie reviews
 * @param movieId - The TMDB movie ID
 * @returns Array of reviews with author details
 */
export const fetchMovieReviews = async (movieId: number): Promise<any[]> => {
  try {
    console.log(`[TMDBMetadata] 📡 Fetching reviews for movie ID: ${movieId}`);
    const response = await axios.get(`${BASE_URL}/movie/${movieId}/reviews`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching movie reviews:', error);
    return [];
  }
};

/**
 * Fetch TV show reviews
 * @param tvId - The TMDB TV show ID
 * @returns Array of reviews with author details
 */
export const fetchTVShowReviews = async (tvId: number): Promise<any[]> => {
  try {
    console.log(`[TMDBMetadata] 📡 Fetching reviews for TV show ID: ${tvId}`);
    const response = await axios.get(`${BASE_URL}/tv/${tvId}/reviews`, {
      params: { api_key: TMDB_API_KEY },
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching TV show reviews:', error);
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
// HELPER FUNCTIONS FOR SEASON DATA
// ──────────────────────────────────────────────────────────────────────────

/**
 * Filter seasons for display (excludes season 0, specials, seasons without air dates)
 * 
 * @param seasons - The raw seasons array from TMDB
 * @returns Filtered array of season numbers for display
 */
export const filterDisplaySeasons = (seasons: any[]): number[] => {
  if (!seasons || !Array.isArray(seasons)) return [];
  
  return seasons
    .filter((season: any) => {
      // EXCLUDE season 0 (specials)
      if (season.season_number === 0) return false;
      
      // EXCLUDE seasons with no air date (often placeholder)
      if (!season.air_date) return false;
      
      // EXCLUDE seasons marked as type 'special'
      if (season.type && season.type === 'special') return false;
      
      // INCLUDE all other seasons
      return true;
    })
    .map((season: any) => season.season_number)
    .sort((a: number, b: number) => a - b);
};

/**
 * Map TMDB season data to ISeason format
 * 
 * @param season - Raw season object from TMDB
 * @returns Formatted season object
 */
export const mapSeasonData = (season: any): any => {
  if (!season) return null;
  
  return {
    seasonNumber: season.season_number || 0,
    episodeCount: season.episode_count || 0,
    airDate: season.air_date || undefined,
    name: season.name || undefined,
    overview: season.overview || undefined,
    posterPath: season.poster_path ? getImageUrl(season.poster_path) : undefined,
    id: season.id || undefined,
  };
};

/**
 * Map multiple seasons to ISeason format
 */
export const mapSeasonsData = (seasons: any[]): any[] => {
  if (!seasons || !Array.isArray(seasons)) return [];
  return seasons.map(mapSeasonData).filter(Boolean);
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
  fetchTVShowDetailsWithSeasons,
  fetchSeasonDetails,
  fetchMultipleSeasonDetails,
  fetchMovieRecommendations,
  fetchTVShowRecommendations,
  // Videos (Trailers)
  fetchMovieVideos,
  fetchTVVideos,
  // Reviews (ADDED)
  fetchMovieReviews,
  fetchTVShowReviews,
  // Genre
  fetchMediaByGenre,
  // Search
  searchMedia,
  // Images
  getImageUrl,
  getHighResImageUrl,
  // Season helpers
  filterDisplaySeasons,
  mapSeasonData,
  mapSeasonsData,
};
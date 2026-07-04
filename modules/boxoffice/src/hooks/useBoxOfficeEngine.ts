/**
 * useBoxOfficeEngine - React hook for BoxOffice SDK operations.
 * Provides stateful access to search, discovery, details, and downloads.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  boxOffice,
  SearchResults,
  SearchResultItem,
  SearchSuggestions,
  TrendingResults,
  HomepageContent,
  HotContent,
  PopularSearches,
  MovieDetails,
  TVSeriesDetails,
  V2ItemDetails,
  DownloadableFiles,
  DownloadMovieResult,
  DownloadTVSeriesResult,
  DownloadStatus,
  DownloadStatusList,
  Recommendations,
  EngineStatus,
  CommandResult,
  SubjectType,
  ApiVersion,
  StatusChangeEvent,
  CommandExecutedEvent,
  DownloadProgressEvent,
  ErrorEvent,
} from '../BoxOfficeBridge'

// ==================== TYPES ====================

export interface UseBoxOfficeEngineState {
  // Status
  isInitialized: boolean
  isRunning: boolean
  status: EngineStatus | null
  
  // Loading states
  isSearching: boolean
  isLoadingDetails: boolean
  isDownloading: boolean
  
  // Data
  searchResults: SearchResults | null
  suggestions: SearchSuggestions | null
  trending: TrendingResults | null
  homepage: HomepageContent | null
  hotContent: HotContent | null
  popularSearches: PopularSearches | null
  movieDetails: MovieDetails | null
  tvSeriesDetails: TVSeriesDetails | null
  itemDetails: V2ItemDetails | null
  downloadableFiles: DownloadableFiles | null
  recommendations: Recommendations | null
  downloadStatus: DownloadStatusList | null
  activeDownloads: DownloadStatus[]
  
  // Selection
  selectedItem: SearchResultItem | null
  
  // Error
  error: string | null
}

export interface UseBoxOfficeEngineActions {
  // Lifecycle
  configure: (config?: { apiVersion?: ApiVersion; downloadDir?: string; captionLanguage?: string; quality?: string }) => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
  refreshStatus: () => Promise<void>
  
  // Search
  search: (query: string, page?: number, perPage?: number, subjectType?: SubjectType, version?: ApiVersion) => Promise<void>
  searchSuggestions: (query: string, version?: ApiVersion) => Promise<void>
  clearSearch: () => void
  
  // Discovery
  loadTrending: (page?: number, perPage?: number, version?: ApiVersion) => Promise<void>
  loadHomepage: (version?: ApiVersion) => Promise<void>
  loadHotContent: (version?: ApiVersion) => Promise<void>
  loadPopularSearches: (version?: ApiVersion) => Promise<void>
  
  // Details
  loadMovieDetails: (urlOrItem: string, version?: ApiVersion) => Promise<void>
  loadTVSeriesDetails: (urlOrItem: string, version?: ApiVersion) => Promise<void>
  loadItemDetails: (urlOrItem: string) => Promise<void>
  loadDownloadableFiles: (item: any, subjectType?: SubjectType, version?: ApiVersion) => Promise<void>
  selectItem: (item: SearchResultItem | null) => void
  
  // Downloads
  downloadMovie: (title: string, quality?: string, captionLanguage?: string, downloadDir?: string, year?: number) => Promise<DownloadMovieResult>
  downloadTVSeries: (title: string, season?: number, episode?: number, limit?: number, quality?: string, captionLanguage?: string, downloadDir?: string, autoMode?: boolean) => Promise<DownloadTVSeriesResult>
  checkDownloadStatus: (downloadId?: string) => Promise<void>
  cancelDownload: (downloadId: string) => Promise<void>
  
  // Recommendations
  loadRecommendations: (urlOrItem: string, page?: number, perPage?: number, version?: ApiVersion) => Promise<void>
  
  // Error handling
  clearError: () => void
}

// ==================== HOOK ====================

export function useBoxOfficeEngine(): [UseBoxOfficeEngineState, UseBoxOfficeEngineActions] {
  const [state, setState] = useState<UseBoxOfficeEngineState>({
    isInitialized: false,
    isRunning: false,
    status: null,
    isSearching: false,
    isLoadingDetails: false,
    isDownloading: false,
    searchResults: null,
    suggestions: null,
    trending: null,
    homepage: null,
    hotContent: null,
    popularSearches: null,
    movieDetails: null,
    tvSeriesDetails: null,
    itemDetails: null,
    downloadableFiles: null,
    recommendations: null,
    downloadStatus: null,
    activeDownloads: [],
    selectedItem: null,
    error: null,
  })

  const eventUnsubscribers = useRef<(() => void)[]>([])

  // Setup event listeners
  useEffect(() => {
    const unsubStatus = boxOffice.onStatusChange((event: StatusChangeEvent) => {
      setState(prev => ({
        ...prev,
        status: {
          ...prev.status,
          status: event.status,
          timestamp: event.timestamp,
        } as EngineStatus,
        isRunning: event.status === 'running',
      }))
    })

    const unsubCommand = boxOffice.onCommandExecuted((event: CommandExecutedEvent) => {
      if (!event.success) {
        setState(prev => ({ ...prev, error: `Command ${event.command} failed` }))
      }
    })

    const unsubProgress = boxOffice.onDownloadProgress((event: DownloadProgressEvent) => {
      setState(prev => {
        const existing = prev.activeDownloads.find(d => d.downloadId === event.downloadId)
        const updated = existing
          ? prev.activeDownloads.map(d => d.downloadId === event.downloadId ? { ...d, ...event } : d)
          : [...prev.activeDownloads, { ...event }]
        return { ...prev, activeDownloads: updated }
      })
    })

    const unsubError = boxOffice.onError((event: ErrorEvent) => {
      setState(prev => ({ ...prev, error: event.errorMessage }))
    })

    eventUnsubscribers.current = [unsubStatus, unsubCommand, unsubProgress, unsubError]

    // Initial status check
    refreshStatus()

    return () => {
      eventUnsubscribers.current.forEach(unsub => unsub())
    }
  }, [])

  // ==================== LIFECYCLE ACTIONS ====================

  const configure = useCallback(async (config = {}) => {
    try {
      setState(prev => ({ ...prev, error: null }))
      const result: CommandResult = await boxOffice.configure({
        apiVersion: config.apiVersion ?? ApiVersion.V2,
        downloadDir: config.downloadDir ?? '',
        captionLanguage: config.captionLanguage ?? 'English',
        quality: config.quality ?? 'best',
      })
      if (result.success) {
        setState(prev => ({ ...prev, isInitialized: true }))
      } else {
        setState(prev => ({ ...prev, error: result.error ?? 'Configuration failed' }))
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Configuration error' }))
    }
  }, [])

  const start = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }))
      const result: CommandResult = await boxOffice.start()
      if (result.success) {
        setState(prev => ({ ...prev, isRunning: true }))
        await refreshStatus()
      } else {
        setState(prev => ({ ...prev, error: result.error ?? 'Failed to start engine' }))
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Start error' }))
    }
  }, [])

  const stop = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }))
      const result: CommandResult = await boxOffice.stop()
      if (result.success) {
        setState(prev => ({ ...prev, isRunning: false }))
        await refreshStatus()
      } else {
        setState(prev => ({ ...prev, error: result.error ?? 'Failed to stop engine' }))
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Stop error' }))
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const status: EngineStatus = await boxOffice.getStatus()
      setState(prev => ({
        ...prev,
        status,
        isRunning: status.running,
      }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Status error' }))
    }
  }, [])

  // ==================== SEARCH ACTIONS ====================

  const search = useCallback(async (
    query: string,
    page: number = 1,
    perPage: number = 24,
    subjectType: SubjectType = SubjectType.ALL,
    version: ApiVersion = ApiVersion.V2
  ) => {
    try {
      setState(prev => ({ ...prev, isSearching: true, error: null }))
      const results: SearchResults = await boxOffice.search(query, page, perPage, subjectType, version)
      setState(prev => ({ ...prev, searchResults: results, isSearching: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Search error', isSearching: false }))
    }
  }, [])

  const searchSuggestions = useCallback(async (query: string, version: ApiVersion = ApiVersion.V2) => {
    try {
      setState(prev => ({ ...prev, error: null }))
      const results: SearchSuggestions = await boxOffice.searchSuggestions(query, version)
      setState(prev => ({ ...prev, suggestions: results }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Suggestions error' }))
    }
  }, [])

  const clearSearch = useCallback(() => {
    setState(prev => ({ ...prev, searchResults: null, suggestions: null }))
  }, [])

  // ==================== DISCOVERY ACTIONS ====================

  const loadTrending = useCallback(async (page: number = 1, perPage: number = 24, version: ApiVersion = ApiVersion.V2) => {
    try {
      setState(prev => ({ ...prev, isSearching: true, error: null }))
      const results: TrendingResults = await boxOffice.getTrending(page, perPage, version)
      setState(prev => ({ ...prev, trending: results, isSearching: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Trending error', isSearching: false }))
    }
  }, [])

  const loadHomepage = useCallback(async (version: ApiVersion = ApiVersion.V2) => {
    try {
      setState(prev => ({ ...prev, isSearching: true, error: null }))
      const results: HomepageContent = await boxOffice.getHomepage(version)
      setState(prev => ({ ...prev, homepage: results, isSearching: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Homepage error', isSearching: false }))
    }
  }, [])

  const loadHotContent = useCallback(async (version: ApiVersion = ApiVersion.V2) => {
    try {
      setState(prev => ({ ...prev, isSearching: true, error: null }))
      const results: HotContent = await boxOffice.getHotContent(version)
      setState(prev => ({ ...prev, hotContent: results, isSearching: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Hot content error', isSearching: false }))
    }
  }, [])

  const loadPopularSearches = useCallback(async (version: ApiVersion = ApiVersion.V2) => {
    try {
      setState(prev => ({ ...prev, error: null }))
      const results: PopularSearches = await boxOffice.getPopularSearches(version)
      setState(prev => ({ ...prev, popularSearches: results }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Popular searches error' }))
    }
  }, [])

  // ==================== DETAILS ACTIONS ====================

  const loadMovieDetails = useCallback(async (urlOrItem: string, version: ApiVersion = ApiVersion.V1) => {
    try {
      setState(prev => ({ ...prev, isLoadingDetails: true, error: null }))
      const details: MovieDetails = await boxOffice.getMovieDetails(urlOrItem, version)
      setState(prev => ({ ...prev, movieDetails: details, isLoadingDetails: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Movie details error', isLoadingDetails: false }))
    }
  }, [])

  const loadTVSeriesDetails = useCallback(async (urlOrItem: string, version: ApiVersion = ApiVersion.V1) => {
    try {
      setState(prev => ({ ...prev, isLoadingDetails: true, error: null }))
      const details: TVSeriesDetails = await boxOffice.getTVSeriesDetails(urlOrItem, version)
      setState(prev => ({ ...prev, tvSeriesDetails: details, isLoadingDetails: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'TV series details error', isLoadingDetails: false }))
    }
  }, [])

  const loadItemDetails = useCallback(async (urlOrItem: string) => {
    try {
      setState(prev => ({ ...prev, isLoadingDetails: true, error: null }))
      const details: V2ItemDetails = await boxOffice.getItemDetails(urlOrItem)
      setState(prev => ({ ...prev, itemDetails: details, isLoadingDetails: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Item details error', isLoadingDetails: false }))
    }
  }, [])

  const loadDownloadableFiles = useCallback(async (item: any, subjectType: SubjectType = SubjectType.MOVIES, version: ApiVersion = ApiVersion.V1) => {
    try {
      setState(prev => ({ ...prev, isLoadingDetails: true, error: null }))
      const files: DownloadableFiles = await boxOffice.getDownloadableFiles(item, subjectType, version)
      setState(prev => ({ ...prev, downloadableFiles: files, isLoadingDetails: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Downloadable files error', isLoadingDetails: false }))
    }
  }, [])

  const selectItem = useCallback((item: SearchResultItem | null) => {
    setState(prev => ({ ...prev, selectedItem: item }))
  }, [])

  // ==================== DOWNLOAD ACTIONS ====================

  const downloadMovie = useCallback(async (
    title: string,
    quality: string = 'best',
    captionLanguage: string = 'English',
    downloadDir: string = '',
    year: number = 0
  ): Promise<DownloadMovieResult> => {
    try {
      setState(prev => ({ ...prev, isDownloading: true, error: null }))
      const result: DownloadMovieResult = await boxOffice.downloadMovie(title, quality, captionLanguage, downloadDir, year)
      setState(prev => ({ ...prev, isDownloading: false }))
      return result
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Download movie error', isDownloading: false }))
      throw err
    }
  }, [])

  const downloadTVSeries = useCallback(async (
    title: string,
    season: number = 1,
    episode: number = 1,
    limit: number = 1,
    quality: string = 'best',
    captionLanguage: string = 'English',
    downloadDir: string = '',
    autoMode: boolean = false
  ): Promise<DownloadTVSeriesResult> => {
    try {
      setState(prev => ({ ...prev, isDownloading: true, error: null }))
      const result: DownloadTVSeriesResult = await boxOffice.downloadTVSeries(
        title, season, episode, limit, quality, captionLanguage, downloadDir, autoMode
      )
      setState(prev => ({ ...prev, isDownloading: false }))
      return result
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Download TV series error', isDownloading: false }))
      throw err
    }
  }, [])

  const checkDownloadStatus = useCallback(async (downloadId?: string) => {
    try {
      const status: DownloadStatusList = await boxOffice.getDownloadStatus(downloadId)
      setState(prev => ({ ...prev, downloadStatus: status }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Download status error' }))
    }
  }, [])

  const cancelDownload = useCallback(async (downloadId: string) => {
    try {
      const result: CommandResult = await boxOffice.cancelDownload(downloadId)
      if (result.success) {
        setState(prev => ({
          ...prev,
          activeDownloads: prev.activeDownloads.filter(d => d.downloadId !== downloadId),
        }))
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Cancel download error' }))
    }
  }, [])

  // ==================== RECOMMENDATIONS ACTIONS ====================

  const loadRecommendations = useCallback(async (urlOrItem: string, page: number = 1, perPage: number = 24, version: ApiVersion = ApiVersion.V1) => {
    try {
      setState(prev => ({ ...prev, isSearching: true, error: null }))
      const results: Recommendations = await boxOffice.getRecommendations(urlOrItem, page, perPage, version)
      setState(prev => ({ ...prev, recommendations: results, isSearching: false }))
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? 'Recommendations error', isSearching: false }))
    }
  }, [])

  // ==================== ERROR HANDLING ====================

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // ==================== RETURN ====================

  const actions: UseBoxOfficeEngineActions = {
    configure,
    start,
    stop,
    refreshStatus,
    search,
    searchSuggestions,
    clearSearch,
    loadTrending,
    loadHomepage,
    loadHotContent,
    loadPopularSearches,
    loadMovieDetails,
    loadTVSeriesDetails,
    loadItemDetails,
    loadDownloadableFiles,
    selectItem,
    downloadMovie,
    downloadTVSeries,
    checkDownloadStatus,
    cancelDownload,
    loadRecommendations,
    clearError,
  }

  return [state, actions]
}

export default useBoxOfficeEngine
/**
 * Nitro module exports for BoxOffice.
 * Re-exports the JSI module and all shared types.
 */

export { BoxOfficeNitroModule } from './BoxOfficeNitroModule.nitro'
export type {
  BoxOfficeNitroModule as IBoxOfficeNitroModule,
} from './BoxOfficeNitroModule.nitro'

// Re-export all shared types from the .nitro.ts file
export {
  SubjectType,
  ApiVersion,
} from './BoxOfficeNitroModule.nitro'

export type {
  SearchResultsPager,
  ContentImage,
  SearchResultItem,
  SearchResults,
  SuggestedItem,
  SearchSuggestions,
  TrendingResults,
  ContentCategory,
  HomepageContent,
  HotContent,
  PopularSearchItem,
  PopularSearches,
  VideoAddress,
  SubjectTrailer,
  MediaFile,
  CaptionFile,
  DownloadableFiles,
  StarsModel,
  ResourceModel,
  MetadataModel,
  PostListItem,
  PostList,
  MovieDetails,
  TVSeriesDetails,
  V2ItemDetails,
  DownloadedFile,
  DownloadMovieResult,
  EpisodeDownload,
  DownloadTVSeriesResult,
  DownloadStatus,
  DownloadStatusList,
  Recommendations,
  EngineStatus,
  CommandResult,
  PongResult,
  StatusChangeEvent,
  CommandExecutedEvent,
  DownloadProgressEvent,
  ErrorEvent,
} from './BoxOfficeNitroModule.nitro'
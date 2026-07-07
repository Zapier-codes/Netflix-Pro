package expo.modules.boxoffice.nitro.types

/**
 * Nitro-specific Kotlin type definitions for the BoxOffice module.
 * Maps to the real moviebox-api SDK response shapes.
 * These are used by the Nitro JSI bridge for type-safe serialization.
 */

// ==================== ENUMS ====================

enum class SubjectType(val value: String) {
    ALL("ALL"),
    MOVIES("MOVIES"),
    TV_SERIES("TV_SERIES"),
    EDUCATION("EDUCATION"),
    MUSIC("MUSIC"),
    ANIME("ANIME"),
    OTHER("OTHER");

    companion object {
        fun fromValue(value: String): SubjectType {
            return values().find { it.value == value } ?: ALL
        }
    }
}

enum class ApiVersion(val value: String) {
    V1("v1"),
    V2("v2");

    companion object {
        fun fromValue(value: String): ApiVersion {
            return values().find { it.value == value } ?: V2
        }
    }
}

// ==================== IMAGE ====================

data class ContentImage(
    val url: String,
    val width: Double,
    val height: Double,
    val size: Double,
    val format: String,
    val thumbnail: String,
    val blurHash: String,
    val gif: String? = null,
    val avgHueLight: String,
    val avgHueDark: String,
    val id: String
)

// ==================== PAGER ====================

data class SearchResultsPager(
    val hasMore: Boolean,
    val nextPage: Double?,
    val page: Double,
    val perPage: Double,
    val totalCount: Double
)

// ==================== SEARCH RESULTS ====================

data class SearchResultItem(
    val subjectId: String,
    val subjectType: SubjectType,
    val title: String,
    val description: String? = null,
    val releaseDate: String? = null,
    val duration: Double? = null,
    val genre: List<String> = emptyList(),
    val cover: ContentImage? = null,
    val countryName: String? = null,
    val imdbRatingValue: Double? = null,
    val detailPath: String,
    val hasResource: Boolean = false,
    val subtitles: List<String> = emptyList(),
    val corner: String? = null,
    val stafflist: List<Any?>? = null,
    val appointmentCnt: Double? = null,
    val appointmentDate: String? = null
)

data class SearchResults(
    val items: List<SearchResultItem>,
    val pager: SearchResultsPager,
    val query: String,
    val version: ApiVersion
)

// ==================== SUGGESTIONS ====================

data class SuggestedItem(
    val type: SubjectType? = null,
    val subject: String? = null,
    val word: String
)

data class SearchSuggestions(
    val items: List<SuggestedItem>,
    val keyword: String,
    val version: ApiVersion
)

// ==================== DISCOVERY ====================

data class TrendingResults(
    val data: List<SearchResultItem>,
    val pager: SearchResultsPager,
    val version: ApiVersion
)

data class ContentCategory(
    val type: String,
    val position: Double,
    val title: String,
    val subjects: List<SearchResultItem>,
    val url: String? = null,
    val opId: String? = null
)

data class Platform(
    val name: String,
    val uploadBy: String
)

data class HomepageContent(
    val categories: List<ContentCategory>,
    val platformList: List<Platform>,
    val version: ApiVersion
)

data class HotContent(
    val movies: List<SearchResultItem>,
    val tvSeries: List<SearchResultItem>,
    val version: ApiVersion
)

data class PopularSearchItem(
    val title: String
)

data class PopularSearches(
    val data: List<PopularSearchItem>,
    val version: ApiVersion
)

// ==================== VIDEO & FILES ====================

data class VideoAddress(
    val videoId: String,
    val definition: String,
    val url: String,
    val duration: Double,
    val width: Double,
    val height: Double,
    val size: Double,
    val fps: Double,
    val type: Double
)

data class SubjectTrailer(
    val videoAddress: VideoAddress,
    val cover: ContentImage
)

data class MediaFile(
    val id: String,
    val url: String,
    val resolution: Double,
    val size: Double
)

data class CaptionFile(
    val id: String,
    val lan: String,
    val lanName: String,
    val url: String,
    val size: Double,
    val delay: Double
)

data class DownloadableFiles(
    val downloads: List<MediaFile>,
    val captions: List<CaptionFile>,
    val limited: Boolean,
    val limitedCode: String? = null,
    val hasResource: Boolean
)

// ==================== STARS & RESOURCE ====================

data class StarsModel(
    val avatarUrl: String,
    val character: String,
    val detailPath: String,
    val name: String,
    val staffId: String,
    val staffType: Double
)

data class ResourceModel(
    val seasons: List<Any?>,
    val source: String,
    val uploadBy: String
)

data class MetadataModel(
    val description: String,
    val image: String,
    val keyWords: List<String>,
    val referer: String? = null,
    val title: String,
    val url: String? = null
)

// ==================== POST LIST ====================

data class PostListItem(
    val id: String,
    val title: String,
    val content: String,
    val createTime: String
)

data class PostList(
    val items: List<PostListItem>,
    val pager: SearchResultsPager
)

// ==================== DETAILS ====================

data class MovieDetails(
    val subject: SearchResultItem,
    val stars: List<StarsModel>,
    val resource: ResourceModel,
    val metadata: MetadataModel,
    val postList: PostList,
    val isForbid: Boolean,
    val watchTimeLimit: Double,
    val version: ApiVersion
)

data class TVSeriesDetails(
    val subject: SearchResultItem,
    val stars: List<StarsModel>,
    val resource: ResourceModel,
    val metadata: MetadataModel,
    val postList: PostList,
    val version: ApiVersion
)

data class V2ItemDetails(
    val subject: SearchResultItem,
    val stars: List<StarsModel>,
    val resource: ResourceModel,
    val metadata: MetadataModel,
    val isForbid: Boolean,
    val watchTimeLimit: Double,
    val version: ApiVersion
)

// ==================== DOWNLOADS ====================

data class DownloadedFile(
    val savedTo: String,
    val size: Double
)

data class DownloadMovieResult(
    val movieFile: DownloadedFile,
    val subtitleFile: DownloadedFile? = null
)

data class EpisodeDownload(
    val savedTo: String,
    val size: Double
)

data class DownloadTVSeriesResult(
    val episodes: Map<String, EpisodeDownload>,
    val total: Double
)

data class DownloadStatus(
    val downloadId: String,
    val downloadedSize: Double,
    val expectedSize: Double,
    val percent: Double,
    val isComplete: Boolean,
    val savedTo: String? = null
)

data class DownloadStatusList(
    val data: List<DownloadStatus>
)

// ==================== RECOMMENDATIONS ====================

data class Recommendations(
    val data: List<SearchResultItem>,
    val pager: SearchResultsPager,
    val version: ApiVersion
)

// ==================== ENGINE ====================

data class EngineStatus(
    val status: String,
    val running: Boolean,
    val defaultVersion: ApiVersion,
    val timestamp: String
)

data class CommandResult(
    val success: Boolean,
    val data: Any? = null,
    val error: String? = null,
    val message: String? = null,
    val timestamp: String? = null
)

data class PongResult(
    val success: Boolean,
    val response: String,
    val timestamp: String,
    val sdkAvailable: Boolean,
    val sdkVersion: String
)

// ==================== EVENTS ====================

data class StatusChangeEvent(
    val status: String,
    val timestamp: String
)

data class CommandExecutedEvent(
    val command: String,
    val success: Boolean,
    val timestamp: String
)

data class DownloadProgressEvent(
    val downloadId: String,
    val downloadedSize: Double,
    val expectedSize: Double,
    val percent: Double,
    val isComplete: Boolean,
    val savedTo: String? = null
)

data class ErrorEvent(
    val errorCode: String,
    val errorMessage: String,
    val command: String? = null
)

// ==================== CONFIG ====================

data class BoxOfficeConfig(
    val apiVersion: ApiVersion,
    val downloadDir: String,
    val captionLanguage: String,
    val quality: String
)
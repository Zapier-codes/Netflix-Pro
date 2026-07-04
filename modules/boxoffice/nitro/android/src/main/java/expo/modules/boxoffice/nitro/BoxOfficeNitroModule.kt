package expo.modules.boxoffice.nitro

import android.os.Handler
import android.os.Looper
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import expo.modules.boxoffice.BoxOfficeEventEmitter
import expo.modules.boxoffice.PythonEngineManager
import kotlinx.coroutines.*
import java.util.concurrent.Executors

class BoxOfficeNitroModule(private val reactContext: ReactApplicationContext) : BoxOfficeNitroModuleSpec() {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private lateinit var engineManager: PythonEngineManager
    private lateinit var eventEmitter: BoxOfficeEventEmitter

    companion object {
        const val PYTHON_PACKAGE = "boxoffice_api"
        const val ENGINE_CLASS = "BoxOfficeEngine"
    }

    init {
        initializePython()
    }

    private fun initializePython() {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactContext.applicationContext))
        }
        engineManager = PythonEngineManager(PYTHON_PACKAGE, ENGINE_CLASS)
        eventEmitter = BoxOfficeEventEmitter(reactContext)
    }

    // ==================== LIFECYCLE ====================

    override fun configure(config: BoxOfficeConfig): Promise<CommandResult> {
        return Promise(scope) {
            val configMap = hashMapOf<String, Any>(
                "api_version" to config.apiVersion.value,
                "download_dir" to config.downloadDir,
                "caption_language" to config.captionLanguage,
                "quality" to config.quality
            )
            val result = engineManager.configure(configMap)
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = result["data"],
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun start(): Promise<CommandResult> {
        return Promise(scope) {
            val result = engineManager.start()
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = result["data"],
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun stop(): Promise<CommandResult> {
        return Promise(scope) {
            val result = engineManager.stop()
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = result["data"],
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun getStatus(): Promise<EngineStatus> {
        return Promise(scope) {
            val result = engineManager.getStatus()
            EngineStatus(
                status = result["status"] as? String ?: "unknown",
                running = result["running"] as? Boolean ?: false,
                defaultVersion = ApiVersion.fromValue(result["default_version"] as? String ?: "v2"),
                timestamp = result["timestamp"] as? String ?: ""
            )
        }
    }

    // ==================== SEARCH ====================

    override fun search(query: String, page: Double, perPage: Double, subjectType: SubjectType, version: ApiVersion): Promise<SearchResults> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "query" to query,
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "subject_type" to subjectType.value,
                "version" to version.value
            )
            val result = engineManager.sendCommand("search", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            SearchResults(
                items = data.map { mapToSearchResultItem(it) },
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = pager["nextPage"] as? Double,
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                query = result["query"] as? String ?: query,
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun searchSuggestions(query: String, version: ApiVersion): Promise<SearchSuggestions> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "query" to query,
                "version" to version.value
            )
            val result = engineManager.sendCommand("search_suggestions", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()

            SearchSuggestions(
                items = data.map {
                    SuggestedItem(
                        type = (it["type"] as? String)?.let { SubjectType.fromValue(it) },
                        subject = it["subject"] as? String,
                        word = it["word"] as? String ?: ""
                    )
                },
                keyword = result["keyword"] as? String ?: query,
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    // ==================== DISCOVERY ====================

    override fun getTrending(page: Double, perPage: Double, version: ApiVersion): Promise<TrendingResults> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "version" to version.value
            )
            val result = engineManager.sendCommand("get_trending", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            TrendingResults(
                data = data.map { mapToSearchResultItem(it) },
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = pager["nextPage"] as? Double,
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun getHomepage(version: ApiVersion): Promise<HomepageContent> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>("version" to version.value)
            val result = engineManager.sendCommand("get_homepage", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()
            val categories = data["categories"] as? List<Map<String, Any?>> ?: emptyList()

            HomepageContent(
                categories = categories.map {
                    ContentCategory(
                        type = it["type"] as? String ?: "",
                        position = (it["position"] as? Number)?.toDouble() ?: 0.0,
                        title = it["title"] as? String ?: "",
                        subjects = (it["subjects"] as? List<Map<String, Any?>>)?.map { sub -> mapToSearchResultItem(sub) } ?: emptyList(),
                        url = it["url"] as? String,
                        opId = it["opId"] as? String
                    )
                },
                platformList = (data["platformList"] as? List<Map<String, Any?>>)?.map {
                    Platform(name = it["name"] as? String ?: "", uploadBy = it["uploadBy"] as? String ?: "")
                } ?: emptyList(),
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun getHotContent(version: ApiVersion): Promise<HotContent> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>("version" to version.value)
            val result = engineManager.sendCommand("get_hot_content", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            HotContent(
                movies = (data["movies"] as? List<Map<String, Any?>>)?.map { mapToSearchResultItem(it) } ?: emptyList(),
                tvSeries = (data["tv_series"] as? List<Map<String, Any?>>)?.map { mapToSearchResultItem(it) } ?: emptyList(),
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun getPopularSearches(version: ApiVersion): Promise<PopularSearches> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>("version" to version.value)
            val result = engineManager.sendCommand("get_popular_searches", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()

            PopularSearches(
                data = data.map { PopularSearchItem(title = it["title"] as? String ?: "") },
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    // ==================== DETAILS ====================

    override fun getMovieDetails(urlOrItem: String, version: ApiVersion): Promise<MovieDetails> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "version" to version.value
            )
            val result = engineManager.sendCommand("get_movie_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            MovieDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) } ?: emptyList(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                postList = mapToPostList(data["postList"] as? Map<String, Any?> ?: emptyMap()),
                isForbid = data["isForbid"] as? Boolean ?: false,
                watchTimeLimit = (data["watchTimeLimit"] as? Number)?.toDouble() ?: 0.0,
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun getTVSeriesDetails(urlOrItem: String, version: ApiVersion): Promise<TVSeriesDetails> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "version" to version.value
            )
            val result = engineManager.sendCommand("get_tv_series_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            TVSeriesDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) } ?: emptyList(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                postList = mapToPostList(data["postList"] as? Map<String, Any?> ?: emptyMap()),
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    override fun getItemDetails(urlOrItem: String): Promise<V2ItemDetails> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>("url_or_item" to urlOrItem)
            val result = engineManager.sendCommand("get_item_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            V2ItemDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) } ?: emptyList(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                isForbid = data["isForbid"] as? Boolean ?: false,
                watchTimeLimit = (data["watchTimeLimit"] as? Number)?.toDouble() ?: 0.0,
                version = ApiVersion.V2
            )
        }
    }

    // ==================== DOWNLOADABLE FILES ====================

    override fun getDownloadableFiles(item: Any, subjectType: SubjectType, version: ApiVersion): Promise<DownloadableFiles> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "item" to item,
                "subject_type" to subjectType.value,
                "version" to version.value
            )
            val result = engineManager.sendCommand("get_downloadable_files", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            DownloadableFiles(
                downloads = (data["downloads"] as? List<Map<String, Any?>>)?.map {
                    MediaFile(
                        id = it["id"] as? String ?: "",
                        url = it["url"] as? String ?: "",
                        resolution = (it["resolution"] as? Number)?.toDouble() ?: 0.0,
                        size = (it["size"] as? Number)?.toDouble() ?: 0.0
                    )
                } ?: emptyList(),
                captions = (data["captions"] as? List<Map<String, Any?>>)?.map {
                    CaptionFile(
                        id = it["id"] as? String ?: "",
                        lan = it["lan"] as? String ?: "",
                        lanName = it["lanName"] as? String ?: "",
                        url = it["url"] as? String ?: "",
                        size = (it["size"] as? Number)?.toDouble() ?: 0.0,
                        delay = (it["delay"] as? Number)?.toDouble() ?: 0.0
                    )
                } ?: emptyList(),
                limited = data["limited"] as? Boolean ?: false,
                limitedCode = data["limitedCode"] as? String,
                hasResource = data["hasResource"] as? Boolean ?: false
            )
        }
    }

    // ==================== DOWNLOADS ====================

    override fun downloadMovie(title: String, quality: String, captionLanguage: String, downloadDir: String, year: Double): Promise<DownloadMovieResult> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "title" to title,
                "quality" to quality,
                "caption_language" to captionLanguage,
                "download_dir" to downloadDir,
                "year" to year.toInt()
            )
            val result = engineManager.sendCommand("download_movie", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()
            val movieFile = data["movie_file"] as? Map<String, Any?> ?: emptyMap()
            val subtitleFile = data["subtitle_file"] as? Map<String, Any?>

            DownloadMovieResult(
                movieFile = DownloadedFile(
                    savedTo = movieFile["saved_to"] as? String ?: "",
                    size = (movieFile["size"] as? Number)?.toDouble() ?: 0.0
                ),
                subtitleFile = subtitleFile?.let {
                    DownloadedFile(
                        savedTo = it["saved_to"] as? String ?: "",
                        size = (it["size"] as? Number)?.toDouble() ?: 0.0
                    )
                }
            )
        }
    }

    override fun downloadTVSeries(title: String, season: Double, episode: Double, limit: Double, quality: String, captionLanguage: String, downloadDir: String, autoMode: Boolean): Promise<DownloadTVSeriesResult> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "title" to title,
                "season" to season.toInt(),
                "episode" to episode.toInt(),
                "limit" to limit.toInt(),
                "quality" to quality,
                "caption_language" to captionLanguage,
                "download_dir" to downloadDir,
                "auto_mode" to autoMode
            )
            val result = engineManager.sendCommand("download_tv_series", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()
            val episodes = data["episodes"] as? Map<String, Map<String, Any?>> ?: emptyMap()

            DownloadTVSeriesResult(
                episodes = episodes.mapValues { (_, value) ->
                    EpisodeDownload(
                        savedTo = value["saved_to"] as? String ?: "",
                        size = (value["size"] as? Number)?.toDouble() ?: 0.0
                    )
                },
                total = (data["total"] as? Number)?.toDouble() ?: 0.0
            )
        }
    }

    override fun getDownloadStatus(downloadId: String?): Promise<DownloadStatusList> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>()
            downloadId?.let { params["download_id"] = it }
            val result = engineManager.sendCommand("get_download_status", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()

            DownloadStatusList(
                data = data.map {
                    DownloadStatus(
                        downloadId = it["download_id"] as? String ?: "",
                        downloadedSize = (it["downloaded_size"] as? Number)?.toDouble() ?: 0.0,
                        expectedSize = (it["expected_size"] as? Number)?.toDouble() ?: 0.0,
                        percent = (it["percent"] as? Number)?.toDouble() ?: 0.0,
                        isComplete = it["is_complete"] as? Boolean ?: false,
                        savedTo = it["saved_to"] as? String
                    )
                }
            )
        }
    }

    override fun cancelDownload(downloadId: String): Promise<CommandResult> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>("download_id" to downloadId)
            val result = engineManager.sendCommand("cancel_download", params)
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    // ==================== RECOMMENDATIONS ====================

    override fun getRecommendations(urlOrItem: String, page: Double, perPage: Double, version: ApiVersion): Promise<Recommendations> {
        return Promise(scope) {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "version" to version.value
            )
            val result = engineManager.sendCommand("get_recommendations", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            Recommendations(
                data = data.map { mapToSearchResultItem(it) },
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = pager["nextPage"] as? Double,
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                version = ApiVersion.fromValue(result["version"] as? String ?: version.value)
            )
        }
    }

    // ==================== MAPPING HELPERS ====================

    private fun mapToSearchResultItem(map: Map<String, Any?>): SearchResultItem {
        val cover = map["cover"] as? Map<String, Any?>
        return SearchResultItem(
            subjectId = map["subjectId"] as? String ?: "",
            subjectType = (map["subjectType"] as? String)?.let { SubjectType.fromValue(it) } ?: SubjectType.ALL,
            title = map["title"] as? String ?: "",
            description = map["description"] as? String,
            releaseDate = map["releaseDate"] as? String,
            duration = (map["duration"] as? Number)?.toDouble(),
            genre = (map["genre"] as? List<String>) ?: emptyList(),
            cover = cover?.let {
                ContentImage(
                    url = it["url"] as? String ?: "",
                    width = (it["width"] as? Number)?.toDouble() ?: 0.0,
                    height = (it["height"] as? Number)?.toDouble() ?: 0.0,
                    size = (it["size"] as? Number)?.toDouble() ?: 0.0,
                    format = it["format"] as? String ?: "",
                    thumbnail = it["thumbnail"] as? String ?: "",
                    blurHash = it["blurHash"] as? String ?: "",
                    gif = it["gif"] as? String,
                    avgHueLight = it["avgHueLight"] as? String ?: "",
                    avgHueDark = it["avgHueDark"] as? String ?: "",
                    id = it["id"] as? String ?: ""
                )
            },
            countryName = map["countryName"] as? String,
            imdbRatingValue = (map["imdbRatingValue"] as? Number)?.toDouble(),
            detailPath = map["detailPath"] as? String ?: "",
            hasResource = map["hasResource"] as? Boolean ?: false,
            subtitles = (map["subtitles"] as? List<String>) ?: emptyList(),
            corner = map["corner"] as? String,
            stafflist = map["stafflist"] as? List<Any?>,
            appointmentCnt = (map["appointmentCnt"] as? Number)?.toDouble(),
            appointmentDate = map["appointmentDate"] as? String
        )
    }

    private fun mapToStarsModel(map: Map<String, Any?>): StarsModel {
        return StarsModel(
            avatarUrl = map["avatarUrl"] as? String ?: "",
            character = map["character"] as? String ?: "",
            detailPath = map["detailPath"] as? String ?: "",
            name = map["name"] as? String ?: "",
            staffId = map["staffId"] as? String ?: "",
            staffType = (map["staffType"] as? Number)?.toDouble() ?: 0.0
        )
    }

    private fun mapToResourceModel(map: Map<String, Any?>): ResourceModel {
        return ResourceModel(
            seasons = (map["seasons"] as? List<Any?>) ?: emptyList(),
            source = map["source"] as? String ?: "",
            uploadBy = map["uploadBy"] as? String ?: ""
        )
    }

    private fun mapToMetadataModel(map: Map<String, Any?>): MetadataModel {
        return MetadataModel(
            description = map["description"] as? String ?: "",
            image = map["image"] as? String ?: "",
            keyWords = (map["keyWords"] as? List<String>) ?: emptyList(),
            referer = map["referer"] as? String,
            title = map["title"] as? String ?: "",
            url = map["url"] as? String
        )
    }

    private fun mapToPostList(map: Map<String, Any?>): PostList {
        val items = map["items"] as? List<Map<String, Any?>> ?: emptyList()
        val pager = map["pager"] as? Map<String, Any?> ?: emptyMap()

        return PostList(
            items = items.map {
                PostListItem(
                    id = it["id"] as? String ?: "",
                    title = it["title"] as? String ?: "",
                    content = it["content"] as? String ?: "",
                    createTime = it["createTime"] as? String ?: ""
                )
            },
            pager = SearchResultsPager(
                hasMore = pager["hasMore"] as? Boolean ?: false,
                nextPage = pager["nextPage"] as? Double,
                page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
            )
        )
    }
}
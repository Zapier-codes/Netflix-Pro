package expo.modules.boxoffice.nitro

import android.os.Handler
import android.os.Looper
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import com.margelo.nitro.boxoffice.*
import com.margelo.nitro.core.AnyMap
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import expo.modules.boxoffice.BoxOfficeEventEmitter
import expo.modules.boxoffice.PythonEngineManager
import kotlinx.coroutines.*
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

// ==================== ENUM HELPERS ====================
// The generated ApiVersionValue / SubjectTypeValue are Nitro enums backed by
// an Int ordinal (.value), NOT the "v1"/"v2" style string the Python SDK
// expects. These helpers translate to/from the wire format used by
// PythonEngineManager, since the generated companion objects are empty
// (no fromValue()) and .value is an Int, not a String.

private fun ApiVersionValue.toApiString(): String = this.name.lowercase()

private fun SubjectTypeValue.toApiString(): String = this.name

private fun parseApiVersion(value: String?, default: ApiVersionValue = ApiVersionValue.V2): ApiVersionValue =
    when (value?.lowercase()) {
        "v1" -> ApiVersionValue.V1
        "v2" -> ApiVersionValue.V2
        else -> default
    }

private fun parseSubjectType(value: String?, default: SubjectTypeValue = SubjectTypeValue.ALL): SubjectTypeValue =
    if (value == null) {
        default
    } else {
        try {
            SubjectTypeValue.valueOf(value)
        } catch (e: IllegalArgumentException) {
            default
        }
    }

// ==================== TYPE CONVERSION HELPERS ====================
// Nitrogen generates `Array<T>` (not Kotlin `List<T>`) for every array-typed
// struct field, and wraps nullable primitives that appear inside structs
// carrying an explicit `| null` in the .nitro.ts spec as sealed
// Variant_NullType_X classes instead of a plain `X?`. It also represents
// untyped JSON-like data (Python dict results with no fixed shape) as
// AnyMap rather than a raw Map/Any. These helpers bridge the loosely-typed
// Map<String, Any?> coming back from PythonEngineManager into those exact
// generated types.

private fun Double?.toVariant(): Variant_NullType_Double =
    if (this == null) Variant_NullType_Double.create(NullType()) else Variant_NullType_Double.create(this)

private fun String?.toVariant(): Variant_NullType_String =
    if (this == null) Variant_NullType_String.create(NullType()) else Variant_NullType_String.create(this)

private fun DownloadedFile?.toVariant(): Variant_NullType_DownloadedFile =
    if (this == null) Variant_NullType_DownloadedFile.create(NullType()) else Variant_NullType_DownloadedFile.create(this)

/**
 * Converts a loosely-typed value coming back from Python (String, Number,
 * Boolean, null, List<*>, Map<*, *>) into an AnyMap-compatible structure.
 * Only Map values become AnyMap itself; use [anyMapArrayOf] for `Array<AnyMap>`
 * fields where each element must individually be an AnyMap.
 *
 * NOTE: verify the exact AnyMap setter names (setString/setDouble/setBoolean/
 * setArray/setObject/setNull) against the version of AnyMap.kt shipped in
 * node_modules/react-native-nitro-modules for your installed Nitro version -
 * these are stable across recent releases but this file could not be
 * inspected directly in this session.
 */
private fun mapToAnyMap(map: Map<*, *>): AnyMap {
    val result = AnyMap()
    for ((k, v) in map) {
        val key = k.toString()
        when (v) {
            null -> result.setNull(key)
            is String -> result.setString(key, v)
            is Boolean -> result.setBoolean(key, v)
            is Int -> result.setDouble(key, v.toDouble())
            is Long -> result.setDouble(key, v.toDouble())
            is Double -> result.setDouble(key, v)
            is Number -> result.setDouble(key, v.toDouble())
            is Map<*, *> -> result.setObject(key, mapToAnyMap(v))
            is List<*> -> result.setArray(key, v.map { anyToAnyMapValue(it) }.toTypedArray())
            else -> result.setString(key, v.toString())
        }
    }
    return result
}

private fun anyToAnyMapValue(value: Any?): Any = when (value) {
    null -> NullType()
    is Map<*, *> -> mapToAnyMap(value)
    is List<*> -> value.map { anyToAnyMapValue(it) }.toTypedArray()
    else -> value
}

/** Converts a `List<Map<*, *>>` (as returned by Python) into `Array<AnyMap>`. */
private fun anyMapArrayOf(list: List<*>?): Array<AnyMap> =
    (list ?: emptyList<Any?>())
        .mapNotNull { it as? Map<*, *> }
        .map { mapToAnyMap(it) }
        .toTypedArray()

class BoxOfficeNitroModule(private val reactContext: ReactApplicationContext) : HybridBoxOfficeNitroModuleSpec() {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

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
        setupEventCallbacks()
    }

    // ==================== EVENT SOURCE WIRING ====================
    // PythonEngineManager.registerEventCallback(eventType, onEvent) is the
    // actual native-side event source: the Python engine invokes onEvent(type,
    // data) whenever something happens. We register the SAME router lambda for
    // every event type rather than four separate lambdas.
    //
    // Why: registerEventCallback's implementation sets a proxy via
    // "KotlinCallbackWrapper.set_proxy" on a shared callback_wrapper module.
    // Confirmed against callback_wrapper.py: KotlinCallbackWrapper._proxy is a
    // single class-level attribute, not one slot per event type - so each
    // registerEventCallback call DOES overwrite the previous one's proxy.
    // Python's BoxOfficeEngine itself stores callbacks correctly per event
    // type (register_event_callback appends to self._event_callbacks[event_type]),
    // but every one of those stored callbacks forwards through the same
    // KotlinCallbackWrapper.call() -> cls._proxy.onEvent(event_type, data),
    // so only the most-recently-set proxy actually receives anything - for
    // any event type. Using one identical router for all four registrations
    // sidesteps this: the router inspects the eventType it's actually called
    // with (which Python still passes correctly per-event) and dispatches
    // off of that, so it works correctly regardless of which proxy is live.
    // - "onStatusChange" and "onCommandExecuted" are the real event-type
    //   strings and payload keys (status/timestamp, command/success/timestamp)
    //   - taken directly from main.py's _emit_event() calls in start()/stop()
    //   and send_command().
    // - "onDownloadProgress" and "onError" are NOT currently emitted anywhere
    //   in main.py or handlers.py - downloads run synchronously with no
    //   progress events, and errors are only returned in the response dict,
    //   never emitted. Registering these two is forward-compatible and
    //   harmless (Python's register_event_callback just stores the callback
    //   in a list that nothing invokes yet), but don't expect them to fire
    //   until the Python side adds matching _emit_event() calls. The
    //   download_id/downloadedSize/etc. and errorCode/errorMessage/etc. keys
    //   below are my best guess at what those would look like if added,
    //   modeled on handle_get_download_status's existing payload shape.
    //
    // Also worth flagging (not fixed here, since it's a separate Python-side
    // issue): PythonEngineManager.unregisterEventCallback(eventType) calls
    // Python's unregister_event_callback(event_type, callback) with only one
    // argument, but that method requires both event_type AND callback. If
    // this ever gets called, it'll throw a missing-argument TypeError from
    // the Python side. Currently unused (removeListener only clears the
    // Kotlin-side lists, it doesn't call into engineManager), so it's latent
    // rather than active, but flagging it for whenever that gets wired up.

    private fun setupEventCallbacks() {
        val router: (String, Map<String, Any>) -> Unit = { eventType, data ->
            when (eventType) {
                "onStatusChange" -> dispatchStatusChange(
                    status = data["status"] as? String ?: "",
                    timestamp = data["timestamp"] as? String ?: ""
                )
                "onCommandExecuted" -> dispatchCommandExecuted(
                    command = data["command"] as? String ?: "",
                    success = data["success"] as? Boolean ?: false,
                    timestamp = data["timestamp"] as? String ?: ""
                )
                "onDownloadProgress" -> dispatchDownloadProgress(
                    downloadId = data["download_id"] as? String ?: "",
                    downloadedSize = (data["downloaded_size"] as? Number)?.toDouble() ?: 0.0,
                    expectedSize = (data["expected_size"] as? Number)?.toDouble() ?: 0.0,
                    percent = (data["percent"] as? Number)?.toDouble() ?: 0.0,
                    isComplete = data["is_complete"] as? Boolean ?: false,
                    // pyObjectToValueStatic maps Python None -> "" (not null), so
                    // an empty string here means "wasn't provided" - convert back
                    // to null to match DownloadProgressEvent's nullable savedTo.
                    savedTo = (data["saved_to"] as? String)?.takeIf { it.isNotEmpty() }
                )
                "onError" -> dispatchError(
                    errorCode = data["error_code"] as? String ?: "",
                    errorMessage = data["error_message"] as? String ?: "",
                    command = (data["command"] as? String)?.takeIf { it.isNotEmpty() }
                )
            }
        }

        engineManager.registerEventCallback("onStatusChange", router)
        engineManager.registerEventCallback("onCommandExecuted", router)
        engineManager.registerEventCallback("onDownloadProgress", router)
        engineManager.registerEventCallback("onError", router)
    }

    // ==================== LIFECYCLE ====================

    override fun configure(config: BoxOfficeConfig): Promise<CommandResult> {
        return Promise.async {
            val configMap = hashMapOf<String, Any>()
            config.apiVersion?.let { configMap["api_version"] = it.toApiString() }
            config.downloadDir?.let { configMap["download_dir"] = it }
            config.captionLanguage?.let { configMap["caption_language"] = it }
            config.quality?.let { configMap["quality"] = it }
            val result = engineManager.configure(configMap)
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = (result["data"] as? Map<*, *>)?.let { mapToAnyMap(it) },
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun start(): Promise<CommandResult> {
        return Promise.async {
            val result = engineManager.start()
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = (result["data"] as? Map<*, *>)?.let { mapToAnyMap(it) },
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun stop(): Promise<CommandResult> {
        return Promise.async {
            val result = engineManager.stop()
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = (result["data"] as? Map<*, *>)?.let { mapToAnyMap(it) },
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    override fun getStatus(): Promise<EngineStatus> {
        return Promise.async {
            val result = engineManager.getStatus()
            EngineStatus(
                status = result["status"] as? String ?: "unknown",
                running = result["running"] as? Boolean ?: false,
                defaultVersion = parseApiVersion(result["default_version"] as? String),
                timestamp = result["timestamp"] as? String ?: ""
            )
        }
    }

    // ==================== SEARCH ====================

    override fun search(query: String, page: Double, perPage: Double, subjectType: SubjectTypeValue, version: ApiVersionValue): Promise<SearchResults> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "query" to query,
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "subject_type" to subjectType.toApiString(),
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("search", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            SearchResults(
                items = data.map { mapToSearchResultItem(it) }.toTypedArray(),
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = (pager["nextPage"] as? Number)?.toDouble().toVariant(),
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                query = result["query"] as? String ?: query,
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun searchSuggestions(query: String, version: ApiVersionValue): Promise<SearchSuggestions> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "query" to query,
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("search_suggestions", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()

            SearchSuggestions(
                items = data.map {
                    SuggestedItem(
                        type = (it["type"] as? String)?.let { t -> parseSubjectType(t) },
                        subject = (it["subject"] as? String).toVariant(),
                        word = it["word"] as? String ?: ""
                    )
                }.toTypedArray(),
                keyword = result["keyword"] as? String ?: query,
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    // ==================== DISCOVERY ====================

    override fun getTrending(page: Double, perPage: Double, version: ApiVersionValue): Promise<TrendingResults> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("get_trending", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            TrendingResults(
                data = data.map { mapToSearchResultItem(it) }.toTypedArray(),
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = (pager["nextPage"] as? Number)?.toDouble().toVariant(),
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun getHomepage(version: ApiVersionValue): Promise<HomepageContent> {
        return Promise.async {
            val params = hashMapOf<String, Any>("version" to version.toApiString())
            val result = engineManager.sendCommand("get_homepage", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()
            val categories = data["categories"] as? List<Map<String, Any?>> ?: emptyList()

            HomepageContent(
                categories = categories.map {
                    ContentCategory(
                        type = it["type"] as? String ?: "",
                        position = (it["position"] as? Number)?.toDouble() ?: 0.0,
                        title = it["title"] as? String ?: "",
                        subjects = (it["subjects"] as? List<Map<String, Any?>>)?.map { sub -> mapToSearchResultItem(sub) }?.toTypedArray() ?: emptyArray(),
                        url = it["url"] as? String,
                        opId = it["opId"] as? String
                    )
                }.toTypedArray(),
                platformList = (data["platformList"] as? List<Map<String, Any?>>)?.map {
                    PlatformInfo(name = it["name"] as? String ?: "", uploadBy = it["uploadBy"] as? String ?: "")
                }?.toTypedArray() ?: emptyArray(),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun getHotContent(version: ApiVersionValue): Promise<HotContent> {
        return Promise.async {
            val params = hashMapOf<String, Any>("version" to version.toApiString())
            val result = engineManager.sendCommand("get_hot_content", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            HotContent(
                movies = (data["movies"] as? List<Map<String, Any?>>)?.map { mapToSearchResultItem(it) }?.toTypedArray() ?: emptyArray(),
                tvSeries = (data["tv_series"] as? List<Map<String, Any?>>)?.map { mapToSearchResultItem(it) }?.toTypedArray() ?: emptyArray(),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun getPopularSearches(version: ApiVersionValue): Promise<PopularSearches> {
        return Promise.async {
            val params = hashMapOf<String, Any>("version" to version.toApiString())
            val result = engineManager.sendCommand("get_popular_searches", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()

            PopularSearches(
                data = data.map { PopularSearchItem(title = it["title"] as? String ?: "") }.toTypedArray(),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    // ==================== DETAILS ====================

    override fun getMovieDetails(urlOrItem: String, version: ApiVersionValue): Promise<MovieDetails> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("get_movie_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            MovieDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) }?.toTypedArray() ?: emptyArray(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                postList = mapToPostList(data["postList"] as? Map<String, Any?> ?: emptyMap()),
                isForbid = data["isForbid"] as? Boolean ?: false,
                watchTimeLimit = (data["watchTimeLimit"] as? Number)?.toDouble() ?: 0.0,
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun getTVSeriesDetails(urlOrItem: String, version: ApiVersionValue): Promise<TVSeriesDetails> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("get_tv_series_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            TVSeriesDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) }?.toTypedArray() ?: emptyArray(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                postList = mapToPostList(data["postList"] as? Map<String, Any?> ?: emptyMap()),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    override fun getItemDetails(urlOrItem: String): Promise<V2ItemDetails> {
        return Promise.async {
            val params = hashMapOf<String, Any>("url_or_item" to urlOrItem)
            val result = engineManager.sendCommand("get_item_details", params)
            val data = result["data"] as? Map<String, Any?> ?: emptyMap()

            V2ItemDetails(
                subject = mapToSearchResultItem(data["subject"] as? Map<String, Any?> ?: emptyMap()),
                stars = (data["stars"] as? List<Map<String, Any?>>)?.map { mapToStarsModel(it) }?.toTypedArray() ?: emptyArray(),
                resource = mapToResourceModel(data["resource"] as? Map<String, Any?> ?: emptyMap()),
                metadata = mapToMetadataModel(data["metadata"] as? Map<String, Any?> ?: emptyMap()),
                isForbid = data["isForbid"] as? Boolean ?: false,
                watchTimeLimit = (data["watchTimeLimit"] as? Number)?.toDouble() ?: 0.0,
                version = ApiVersionValue.V2
            )
        }
    }

    // ==================== DOWNLOADABLE FILES ====================

    override fun getDownloadableFiles(item: SearchResultItem, subjectType: SubjectTypeValue, version: ApiVersionValue): Promise<DownloadableFiles> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "item" to item,
                "subject_type" to subjectType.toApiString(),
                "version" to version.toApiString()
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
                }?.toTypedArray() ?: emptyArray(),
                captions = (data["captions"] as? List<Map<String, Any?>>)?.map {
                    CaptionFile(
                        id = it["id"] as? String ?: "",
                        lan = it["lan"] as? String ?: "",
                        lanName = it["lanName"] as? String ?: "",
                        url = it["url"] as? String ?: "",
                        size = (it["size"] as? Number)?.toDouble() ?: 0.0,
                        delay = (it["delay"] as? Number)?.toDouble() ?: 0.0
                    )
                }?.toTypedArray() ?: emptyArray(),
                limited = data["limited"] as? Boolean ?: false,
                limitedCode = data["limitedCode"] as? String,
                hasResource = data["hasResource"] as? Boolean ?: false
            )
        }
    }

    // ==================== DOWNLOADS ====================

    override fun downloadMovie(title: String, quality: String, captionLanguage: String, downloadDir: String, year: Double): Promise<DownloadMovieResult> {
        return Promise.async {
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
                }.toVariant()
            )
        }
    }

    override fun downloadTVSeries(title: String, season: Double, episode: Double, limit: Double, quality: String, captionLanguage: String, downloadDir: String, autoMode: Boolean): Promise<DownloadTVSeriesResult> {
        return Promise.async {
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
        return Promise.async {
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
                }.toTypedArray()
            )
        }
    }

    override fun cancelDownload(downloadId: String): Promise<CommandResult> {
        return Promise.async {
            val params = hashMapOf<String, Any>("download_id" to downloadId)
            val result = engineManager.sendCommand("cancel_download", params)
            CommandResult(
                success = result["success"] as? Boolean ?: false,
                data = (result["data"] as? Map<*, *>)?.let { mapToAnyMap(it) },
                error = result["error"] as? String,
                message = result["message"] as? String,
                timestamp = result["timestamp"] as? String
            )
        }
    }

    // ==================== RECOMMENDATIONS ====================

    override fun getRecommendations(urlOrItem: String, page: Double, perPage: Double, version: ApiVersionValue): Promise<Recommendations> {
        return Promise.async {
            val params = hashMapOf<String, Any>(
                "url_or_item" to urlOrItem,
                "page" to page.toInt(),
                "per_page" to perPage.toInt(),
                "version" to version.toApiString()
            )
            val result = engineManager.sendCommand("get_recommendations", params)
            val data = result["data"] as? List<Map<String, Any?>> ?: emptyList()
            val pager = result["pager"] as? Map<String, Any?> ?: emptyMap()

            Recommendations(
                data = data.map { mapToSearchResultItem(it) }.toTypedArray(),
                pager = SearchResultsPager(
                    hasMore = pager["hasMore"] as? Boolean ?: false,
                    nextPage = (pager["nextPage"] as? Number)?.toDouble().toVariant(),
                    page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                    perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                    totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
                ),
                version = parseApiVersion(result["version"] as? String, version)
            )
        }
    }

    // ==================== EVENTS ====================
    // The Nitro spec's listener methods use direct typed callbacks: JS registers
    // a function and native holds a reference, calling it directly with a typed
    // event object. BoxOfficeEventEmitter, by contrast, was built for the old
    // RCTDeviceEventEmitter bridge (WritableMap payloads consumed via
    // NativeEventEmitter on the JS side) - a different delivery mechanism that
    // can't satisfy the Nitro listener methods directly.
    //
    // So: we maintain our own callback lists here for the Nitro-style listeners,
    // and also fire through BoxOfficeEventEmitter so anything still listening
    // the old bridge way keeps working.
    //
    // Field names (status/timestamp, command/success/timestamp,
    // downloadId/downloadedSize/expectedSize/percent/isComplete/savedTo,
    // errorCode/errorMessage/command) confirmed against the generated
    // nitrogen/generated/android/.../boxoffice/*.kt data classes. Event-name
    // strings used in removeListener below confirmed against the call sites
    // in BoxOfficeBridge.ts (and match BoxOfficeEventEmitter's own constants).

    private val statusChangeListeners = CopyOnWriteArrayList<(StatusChangeEvent) -> Unit>()
    private val commandExecutedListeners = CopyOnWriteArrayList<(CommandExecutedEvent) -> Unit>()
    private val downloadProgressListeners = CopyOnWriteArrayList<(DownloadProgressEvent) -> Unit>()
    private val errorListeners = CopyOnWriteArrayList<(ErrorEvent) -> Unit>()

    override fun addStatusChangeListener(callback: (event: StatusChangeEvent) -> Unit) {
        statusChangeListeners.add(callback)
    }

    override fun addCommandExecutedListener(callback: (event: CommandExecutedEvent) -> Unit) {
        commandExecutedListeners.add(callback)
    }

    override fun addDownloadProgressListener(callback: (event: DownloadProgressEvent) -> Unit) {
        downloadProgressListeners.add(callback)
    }

    override fun addErrorListener(callback: (event: ErrorEvent) -> Unit) {
        errorListeners.add(callback)
    }

    override fun removeListener(event: String, callback: () -> Unit) {
        // The spec's removeListener signature (callback: () -> Unit) doesn't carry
        // enough type information to identify one specific typed listener by
        // identity, so a targeted removal isn't possible here. As a practical
        // fallback - matching the common Nitro/EventEmitter pattern of
        // removeAllListeners(event) when per-callback removal isn't wired up
        // natively - we clear every listener registered for the named event.
        when (event) {
            "onBoxOfficeStatusChange" -> statusChangeListeners.clear()
            "onBoxOfficeCommandExecuted" -> commandExecutedListeners.clear()
            "onBoxOfficeDownloadProgress" -> downloadProgressListeners.clear()
            "onBoxOfficeError" -> errorListeners.clear()
        }
    }

    // ---- Dispatch helpers ----
    // Call these from wherever native-side events actually originate (e.g. a
    // PythonEngineManager callback, a polling loop, a download worker). Each one
    // notifies the new Nitro-style listeners on the main thread (JS callbacks
    // should be invoked on the main thread) and also fires the legacy
    // BoxOfficeEventEmitter bridge event for backward compatibility.

    fun dispatchStatusChange(status: String, timestamp: String) {
        val event = StatusChangeEvent(status = status, timestamp = timestamp)
        mainHandler.post {
            for (listener in statusChangeListeners) {
                try {
                    listener(event)
                } catch (e: Exception) {
                    // Isolate listener failures so one throwing callback can't
                    // block the rest - mirrors main.py's _emit_event try/except.
                }
            }
        }
        eventEmitter.emitStatusChange(status, timestamp)
    }

    fun dispatchCommandExecuted(command: String, success: Boolean, timestamp: String) {
        val event = CommandExecutedEvent(command = command, success = success, timestamp = timestamp)
        mainHandler.post {
            for (listener in commandExecutedListeners) {
                try {
                    listener(event)
                } catch (e: Exception) {
                    // Isolate listener failures; see dispatchStatusChange.
                }
            }
        }
        eventEmitter.emitCommandExecuted(command, success, timestamp)
    }

    fun dispatchDownloadProgress(
        downloadId: String,
        downloadedSize: Double,
        expectedSize: Double,
        percent: Double,
        isComplete: Boolean,
        savedTo: String?
    ) {
        val event = DownloadProgressEvent(
            downloadId = downloadId,
            downloadedSize = downloadedSize,
            expectedSize = expectedSize,
            percent = percent,
            isComplete = isComplete,
            savedTo = savedTo
        )
        mainHandler.post {
            for (listener in downloadProgressListeners) {
                try {
                    listener(event)
                } catch (e: Exception) {
                    // Isolate listener failures; see dispatchStatusChange.
                }
            }
        }
        eventEmitter.emitDownloadProgress(
            downloadId,
            downloadedSize.toLong(),
            expectedSize.toLong(),
            percent,
            isComplete,
            savedTo
        )
    }

    fun dispatchError(errorCode: String, errorMessage: String, command: String? = null) {
        val event = ErrorEvent(errorCode = errorCode, errorMessage = errorMessage, command = command)
        mainHandler.post {
            for (listener in errorListeners) {
                try {
                    listener(event)
                } catch (e: Exception) {
                    // Isolate listener failures; see dispatchStatusChange.
                }
            }
        }
        eventEmitter.emitError(errorCode, errorMessage, command)
    }

    // ==================== MAPPING HELPERS ====================

    private fun mapToSearchResultItem(map: Map<String, Any?>): SearchResultItem {
        val cover = map["cover"] as? Map<String, Any?>
        return SearchResultItem(
            subjectId = map["subjectId"] as? String ?: "",
            subjectType = parseSubjectType(map["subjectType"] as? String),
            title = map["title"] as? String ?: "",
            description = map["description"] as? String,
            releaseDate = map["releaseDate"] as? String,
            duration = (map["duration"] as? Number)?.toDouble(),
            genre = (map["genre"] as? List<String>)?.toTypedArray() ?: emptyArray(),
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
            subtitles = (map["subtitles"] as? List<String>)?.toTypedArray() ?: emptyArray(),
            corner = map["corner"] as? String,
            stafflist = (map["stafflist"] as? List<*>)?.let { anyMapArrayOf(it) },
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
            seasons = anyMapArrayOf(map["seasons"] as? List<*>),
            source = map["source"] as? String ?: "",
            uploadBy = map["uploadBy"] as? String ?: ""
        )
    }

    private fun mapToMetadataModel(map: Map<String, Any?>): MetadataModel {
        return MetadataModel(
            description = map["description"] as? String ?: "",
            image = map["image"] as? String ?: "",
            keyWords = (map["keyWords"] as? List<String>)?.toTypedArray() ?: emptyArray(),
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
            }.toTypedArray(),
            pager = SearchResultsPager(
                hasMore = pager["hasMore"] as? Boolean ?: false,
                nextPage = (pager["nextPage"] as? Number)?.toDouble().toVariant(),
                page = (pager["page"] as? Number)?.toDouble() ?: 1.0,
                perPage = (pager["perPage"] as? Number)?.toDouble() ?: 24.0,
                totalCount = (pager["totalCount"] as? Number)?.toDouble() ?: 0.0
            )
        )
    }
}

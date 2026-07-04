package expo.modules.boxoffice

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.util.concurrent.Executors

class BoxOfficeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var engineManager: PythonEngineManager
    private lateinit var eventEmitter: BoxOfficeEventEmitter

    companion object {
        const val MODULE_NAME = "BoxOfficeModule"
        const val PYTHON_PACKAGE = "boxoffice_api"
        const val ENGINE_CLASS = "BoxOfficeEngine"
    }

    init {
        initializePython()
    }

    private fun initializePython() {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactApplicationContext.applicationContext))
        }
        engineManager = PythonEngineManager(PYTHON_PACKAGE, ENGINE_CLASS)
        eventEmitter = BoxOfficeEventEmitter(reactApplicationContext)
    }

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "EVENT_STATUS_CHANGE" to "onBoxOfficeStatusChange",
            "EVENT_COMMAND_EXECUTED" to "onBoxOfficeCommandExecuted",
            "EVENT_DOWNLOAD_PROGRESS" to "onBoxOfficeDownloadProgress",
            "EVENT_ERROR" to "onBoxOfficeError",
            "SUBJECT_TYPE_ALL" to "ALL",
            "SUBJECT_TYPE_MOVIES" to "MOVIES",
            "SUBJECT_TYPE_TV_SERIES" to "TV_SERIES",
            "SUBJECT_TYPE_EDUCATION" to "EDUCATION",
            "SUBJECT_TYPE_MUSIC" to "MUSIC",
            "SUBJECT_TYPE_ANIME" to "ANIME",
            "SUBJECT_TYPE_OTHER" to "OTHER",
            "API_VERSION_V1" to "v1",
            "API_VERSION_V2" to "v2"
        )
    }

    // ==================== LIFECYCLE ====================

    @ReactMethod
    fun configure(config: ReadableMap, promise: Promise) {
        executor.execute {
            try {
                val result = engineManager.configure(config.toHashMap())
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("CONFIGURE_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun start(promise: Promise) {
        executor.execute {
            try {
                val result = engineManager.start()
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("START_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        executor.execute {
            try {
                val result = engineManager.stop()
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("STOP_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        executor.execute {
            try {
                val result = engineManager.getStatus()
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("STATUS_ERROR", e.message, e) }
            }
        }
    }

    // ==================== SEARCH ====================

    @ReactMethod
    fun search(query: String, page: Int, perPage: Int, subjectType: String, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "query" to query,
                    "page" to page,
                    "per_page" to perPage,
                    "subject_type" to subjectType,
                    "version" to version
                )
                val result = engineManager.sendCommand("search", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("SEARCH_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun searchSuggestions(query: String, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "query" to query,
                    "version" to version
                )
                val result = engineManager.sendCommand("search_suggestions", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("SUGGESTIONS_ERROR", e.message, e) }
            }
        }
    }

    // ==================== DISCOVERY ====================

    @ReactMethod
    fun getTrending(page: Int, perPage: Int, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "page" to page,
                    "per_page" to perPage,
                    "version" to version
                )
                val result = engineManager.sendCommand("get_trending", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("TRENDING_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getHomepage(version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "version" to version
                )
                val result = engineManager.sendCommand("get_homepage", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("HOMEPAGE_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getHotContent(version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "version" to version
                )
                val result = engineManager.sendCommand("get_hot_content", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("HOT_CONTENT_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getPopularSearches(version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "version" to version
                )
                val result = engineManager.sendCommand("get_popular_searches", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("POPULAR_SEARCHES_ERROR", e.message, e) }
            }
        }
    }

    // ==================== DETAILS ====================

    @ReactMethod
    fun getMovieDetails(urlOrItem: String, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "url_or_item" to urlOrItem,
                    "version" to version
                )
                val result = engineManager.sendCommand("get_movie_details", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("MOVIE_DETAILS_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getTVSeriesDetails(urlOrItem: String, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "url_or_item" to urlOrItem,
                    "version" to version
                )
                val result = engineManager.sendCommand("get_tv_series_details", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("TV_SERIES_DETAILS_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getItemDetails(urlOrItem: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "url_or_item" to urlOrItem
                )
                val result = engineManager.sendCommand("get_item_details", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("ITEM_DETAILS_ERROR", e.message, e) }
            }
        }
    }

    // ==================== DOWNLOADABLE FILES ====================

    @ReactMethod
    fun getDownloadableFiles(item: ReadableMap, subjectType: String, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "item" to item.toHashMap(),
                    "subject_type" to subjectType,
                    "version" to version
                )
                val result = engineManager.sendCommand("get_downloadable_files", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("DOWNLOADABLE_FILES_ERROR", e.message, e) }
            }
        }
    }

    // ==================== DOWNLOADS ====================

    @ReactMethod
    fun downloadMovie(title: String, quality: String, captionLanguage: String, downloadDir: String, year: Int, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "title" to title,
                    "quality" to quality,
                    "caption_language" to captionLanguage,
                    "download_dir" to downloadDir,
                    "year" to year
                )
                val result = engineManager.sendCommand("download_movie", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("DOWNLOAD_MOVIE_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun downloadTVSeries(title: String, season: Int, episode: Int, limit: Int, quality: String, captionLanguage: String, downloadDir: String, autoMode: Boolean, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "title" to title,
                    "season" to season,
                    "episode" to episode,
                    "limit" to limit,
                    "quality" to quality,
                    "caption_language" to captionLanguage,
                    "download_dir" to downloadDir,
                    "auto_mode" to autoMode
                )
                val result = engineManager.sendCommand("download_tv_series", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("DOWNLOAD_TV_SERIES_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun getDownloadStatus(downloadId: String?, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>()
                if (downloadId != null) {
                    params["download_id"] = downloadId
                }
                val result = engineManager.sendCommand("get_download_status", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("DOWNLOAD_STATUS_ERROR", e.message, e) }
            }
        }
    }

    @ReactMethod
    fun cancelDownload(downloadId: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "download_id" to downloadId
                )
                val result = engineManager.sendCommand("cancel_download", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("CANCEL_DOWNLOAD_ERROR", e.message, e) }
            }
        }
    }

    // ==================== RECOMMENDATIONS ====================

    @ReactMethod
    fun getRecommendations(urlOrItem: String, page: Int, perPage: Int, version: String, promise: Promise) {
        executor.execute {
            try {
                val params = hashMapOf<String, Any>(
                    "url_or_item" to urlOrItem,
                    "page" to page,
                    "per_page" to perPage,
                    "version" to version
                )
                val result = engineManager.sendCommand("get_recommendations", params)
                mainHandler.post { promise.resolve(convertToWritableMap(result)) }
            } catch (e: Exception) {
                mainHandler.post { promise.reject("RECOMMENDATIONS_ERROR", e.message, e) }
            }
        }
    }

    // ==================== EVENTS ====================

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    // ==================== HELPERS ====================

    private fun convertToWritableMap(map: Map<String, Any?>): WritableMap {
        val writableMap = Arguments.createMap()
        for ((key, value) in map) {
            when (value) {
                null -> writableMap.putNull(key)
                is String -> writableMap.putString(key, value)
                is Int -> writableMap.putInt(key, value)
                is Double -> writableMap.putDouble(key, value)
                is Boolean -> writableMap.putBoolean(key, value)
                is Map<*, *> -> writableMap.putMap(key, convertToWritableMap(value as Map<String, Any?>))
                is List<*> -> writableMap.putArray(key, convertToWritableArray(value))
                else -> writableMap.putString(key, value.toString())
            }
        }
        return writableMap
    }

    private fun convertToWritableArray(list: List<*>): WritableArray {
        val writableArray = Arguments.createArray()
        for (item in list) {
            when (item) {
                null -> writableArray.pushNull()
                is String -> writableArray.pushString(item)
                is Int -> writableArray.pushInt(item)
                is Double -> writableArray.pushDouble(item)
                is Boolean -> writableArray.pushBoolean(item)
                is Map<*, *> -> writableArray.pushMap(convertToWritableMap(item as Map<String, Any?>))
                is List<*> -> writableArray.pushArray(convertToWritableArray(item))
                else -> writableArray.pushString(item.toString())
            }
        }
        return writableArray
    }

    fun cleanup() {
        executor.shutdown()
        engineManager.cleanup()
    }
}
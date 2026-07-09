package com.margelo.nitro.boxoffice

import com.margelo.nitro.boxoffice.*
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.AnyMap
import expo.modules.boxoffice.PythonEngineManager
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.margelo.nitro.NitroModules

class HybridBoxOfficeNitroModule : HybridBoxOfficeNitroModuleSpec() {

  companion object {
    private const val PYTHON_PACKAGE = "boxoffice_api"
    private const val ENGINE_CLASS = "BoxOfficeEngine"
  }

  private fun ensurePythonStarted() {
    if (!Python.isStarted()) {
      val context = NitroModules.applicationContext
        ?: error("NitroModules.applicationContext is null - cannot start Python interpreter")
      Python.start(AndroidPlatform(context))
    }
  }

  private val engineManager: PythonEngineManager by lazy {
    ensurePythonStarted()
    PythonEngineManager(PYTHON_PACKAGE, ENGINE_CLASS)
  }

  private val statusChangeListeners = mutableListOf<(StatusChangeEvent) -> Unit>()
  private val commandExecutedListeners = mutableListOf<(CommandExecutedEvent) -> Unit>()
  private val downloadProgressListeners = mutableListOf<(DownloadProgressEvent) -> Unit>()
  private val errorListeners = mutableListOf<(ErrorEvent) -> Unit>()
  private var eventsRegistered = false

  private fun ensureEventsRegistered() {
    if (eventsRegistered) return
    eventsRegistered = true
    engineManager.registerEventCallback("status_change") { _, data ->
      val event = StatusChangeEvent(status = data["status"].asStr(), timestamp = data["timestamp"].asStr())
      statusChangeListeners.forEach { it(event) }
    }
    engineManager.registerEventCallback("command_executed") { _, data ->
      val event = CommandExecutedEvent(command = data["command"].asStr(), success = data["success"].asBool(), timestamp = data["timestamp"].asStr())
      commandExecutedListeners.forEach { it(event) }
    }
    engineManager.registerEventCallback("download_progress") { _, data ->
      val event = DownloadProgressEvent(
        downloadId = data["download_id"].asStr(),
        downloadedSize = data["downloaded_size"].asDouble(),
        expectedSize = data["expected_size"].asDouble(),
        percent = data["percent"].asDouble(),
        isComplete = data["is_complete"].asBool(),
        savedTo = data["saved_to"].asStrOrNull()
      )
      downloadProgressListeners.forEach { it(event) }
    }
    engineManager.registerEventCallback("error") { _, data ->
      val event = ErrorEvent(errorCode = data["error_code"].asStr(), errorMessage = data["error_message"].asStr(), command = data["command"].asStrOrNull())
      errorListeners.forEach { it(event) }
    }
  }

  override fun addStatusChangeListener(callback: (event: StatusChangeEvent) -> Unit) {
    ensureEventsRegistered()
    statusChangeListeners.add(callback)
  }

  override fun addCommandExecutedListener(callback: (event: CommandExecutedEvent) -> Unit) {
    ensureEventsRegistered()
    commandExecutedListeners.add(callback)
  }

  override fun addDownloadProgressListener(callback: (event: DownloadProgressEvent) -> Unit) {
    ensureEventsRegistered()
    downloadProgressListeners.add(callback)
  }

  override fun addErrorListener(callback: (event: ErrorEvent) -> Unit) {
    ensureEventsRegistered()
    errorListeners.add(callback)
  }

  override fun removeListener(event: String, callback: () -> Unit) {
    when (event) {
      "onBoxOfficeStatusChange" -> statusChangeListeners.clear()
      "onBoxOfficeCommandExecuted" -> commandExecutedListeners.clear()
      "onBoxOfficeDownloadProgress" -> downloadProgressListeners.clear()
      "onBoxOfficeError" -> errorListeners.clear()
    }
  }

  override fun configure(config: BoxOfficeConfig): Promise<CommandResult> = Promise.parallel {
    val params = mutableMapOf<String, Any?>(
      "download_dir" to config.downloadDir,
      "caption_language" to config.captionLanguage,
      "quality" to config.quality
    )
    config.apiVersion?.let { params["api_version"] = it.toApiString() }
    buildCommandResult(engineManager.configure(params))
  }

  override fun start(): Promise<CommandResult> = Promise.parallel {
    buildCommandResult(engineManager.start())
  }

  override fun stop(): Promise<CommandResult> = Promise.parallel {
    buildCommandResult(engineManager.stop())
  }

  override fun getStatus(): Promise<EngineStatus> = Promise.parallel {
    buildEngineStatus(engineManager.getStatus())
  }

  override fun search(query: String, page: Double, perPage: Double, subjectType: SubjectTypeValue, version: ApiVersionValue): Promise<SearchResults> = Promise.parallel {
    val params = mapOf(
      "query" to query, "page" to page.toInt(), "per_page" to perPage.toInt(),
      "subject_type" to subjectType.name, "version" to version.toApiString()
    )
    buildSearchResults(engineManager.sendCommand("search", params))
  }

  override fun searchSuggestions(query: String, version: ApiVersionValue): Promise<SearchSuggestions> = Promise.parallel {
    val params = mapOf("query" to query, "version" to version.toApiString())
    buildSearchSuggestions(engineManager.sendCommand("search_suggestions", params))
  }

  override fun getTrending(page: Double, perPage: Double, version: ApiVersionValue): Promise<TrendingResults> = Promise.parallel {
    val params = mapOf("page" to page.toInt(), "per_page" to perPage.toInt(), "version" to version.toApiString())
    buildTrendingResults(engineManager.sendCommand("get_trending", params))
  }

  override fun getHomepage(version: ApiVersionValue): Promise<HomepageContent> = Promise.parallel {
    buildHomepageContent(engineManager.sendCommand("get_homepage", mapOf("version" to version.toApiString())))
  }

  override fun getHotContent(version: ApiVersionValue): Promise<HotContent> = Promise.parallel {
    buildHotContent(engineManager.sendCommand("get_hot_content", mapOf("version" to version.toApiString())))
  }

  override fun getPopularSearches(version: ApiVersionValue): Promise<PopularSearches> = Promise.parallel {
    buildPopularSearches(engineManager.sendCommand("get_popular_searches", mapOf("version" to version.toApiString())))
  }

  override fun getMovieDetails(urlOrItem: String, version: ApiVersionValue): Promise<MovieDetails> = Promise.parallel {
    val params = mapOf("url_or_item" to urlOrItem, "version" to version.toApiString())
    buildMovieDetails(engineManager.sendCommand("get_movie_details", params))
  }

  override fun getTVSeriesDetails(urlOrItem: String, version: ApiVersionValue): Promise<TVSeriesDetails> = Promise.parallel {
    val params = mapOf("url_or_item" to urlOrItem, "version" to version.toApiString())
    buildTVSeriesDetails(engineManager.sendCommand("get_tv_series_details", params))
  }

  override fun getItemDetails(urlOrItem: String): Promise<V2ItemDetails> = Promise.parallel {
    buildV2ItemDetails(engineManager.sendCommand("get_item_details", mapOf("url_or_item" to urlOrItem)))
  }

  override fun getDownloadableFiles(item: SearchResultItem, subjectType: SubjectTypeValue, version: ApiVersionValue): Promise<DownloadableFiles> = Promise.parallel {
    val params = mapOf(
      "item" to searchResultItemToMap(item),
      "subject_type" to subjectType.name,
      "version" to version.toApiString()
    )
    buildDownloadableFiles(engineManager.sendCommand("get_downloadable_files", params))
  }

  override fun downloadMovie(title: String, quality: String, captionLanguage: String, downloadDir: String, year: Double): Promise<DownloadMovieResult> = Promise.parallel {
    val params = mapOf(
      "title" to title, "quality" to quality, "caption_language" to captionLanguage,
      "download_dir" to downloadDir, "year" to year.toInt()
    )
    buildDownloadMovieResult(engineManager.sendCommand("download_movie", params))
  }

  override fun downloadTVSeries(title: String, season: Double, episode: Double, limit: Double, quality: String, captionLanguage: String, downloadDir: String, autoMode: Boolean): Promise<DownloadTVSeriesResult> = Promise.parallel {
    val params = mapOf(
      "title" to title, "season" to season.toInt(), "episode" to episode.toInt(),
      "limit" to limit.toInt(), "quality" to quality, "caption_language" to captionLanguage,
      "download_dir" to downloadDir, "auto_mode" to autoMode
    )
    buildDownloadTVSeriesResult(engineManager.sendCommand("download_tv_series", params))
  }

  override fun getDownloadStatus(downloadId: String?): Promise<DownloadStatusList> = Promise.parallel {
    val params = mutableMapOf<String, Any?>()
    downloadId?.let { params["download_id"] = it }
    buildDownloadStatusList(engineManager.sendCommand("get_download_status", params))
  }

  override fun cancelDownload(downloadId: String): Promise<CommandResult> = Promise.parallel {
    buildCommandResult(engineManager.sendCommand("cancel_download", mapOf("download_id" to downloadId)))
  }

  override fun getRecommendations(urlOrItem: String, page: Double, perPage: Double, version: ApiVersionValue): Promise<Recommendations> = Promise.parallel {
    val params = mapOf(
      "url_or_item" to urlOrItem, "page" to page.toInt(), "per_page" to perPage.toInt(), "version" to version.toApiString()
    )
    buildRecommendations(engineManager.sendCommand("get_recommendations", params))
  }

  // ==================== CONVERSION HELPERS ====================

  private fun Any?.asDouble(): Double = when (this) {
    is Double -> this
    is Int -> this.toDouble()
    is Long -> this.toDouble()
    is Float -> this.toDouble()
    is String -> this.toDoubleOrNull() ?: 0.0
    else -> 0.0
  }

  private fun Any?.asDoubleOrNull(): Double? = if (this == null || this == "") null else this.asDouble()

  private fun Any?.asBool(): Boolean = this as? Boolean ?: false

  private fun Any?.asStr(): String = this?.toString() ?: ""

  private fun Any?.asStrOrNull(): String? {
    val s = this?.toString()
    return if (s.isNullOrEmpty()) null else s
  }

  @Suppress("UNCHECKED_CAST")
  private fun Any?.asMap(): Map<String, Any?> = this as? Map<String, Any?> ?: emptyMap()

  @Suppress("UNCHECKED_CAST")
  private fun Any?.asMapOrNull(): Map<String, Any?>? = this as? Map<String, Any?>

  @Suppress("UNCHECKED_CAST")
  private fun Any?.asList(): List<Any?> = this as? List<Any?> ?: emptyList()

  private fun apiVersionFrom(value: Any?): ApiVersionValue = if (value.asStr() == "v2") ApiVersionValue.V2 else ApiVersionValue.V1

  private fun ApiVersionValue.toApiString(): String = if (this == ApiVersionValue.V2) "v2" else "v1"

  private fun subjectTypeFrom(value: Any?): SubjectTypeValue = when (value.asStr()) {
    "MOVIES" -> SubjectTypeValue.MOVIES
    "TV_SERIES" -> SubjectTypeValue.TV_SERIES
    "EDUCATION" -> SubjectTypeValue.EDUCATION
    "MUSIC" -> SubjectTypeValue.MUSIC
    "ANIME" -> SubjectTypeValue.ANIME
    "OTHER" -> SubjectTypeValue.OTHER
    else -> SubjectTypeValue.ALL
  }

  private fun buildContentImage(m: Map<String, Any?>?): ContentImage? {
    if (m == null) return null
    return ContentImage(
      url = m["url"].asStr(), width = m["width"].asDouble(), height = m["height"].asDouble(),
      size = m["size"].asDouble(), format = m["format"].asStr(), thumbnail = m["thumbnail"].asStr(),
      blurHash = m["blur_hash"].asStr(), gif = m["gif"].asStrOrNull(),
      avgHueLight = m["avg_hue_light"].asStr(), avgHueDark = m["avg_hue_dark"].asStr(), id = m["id"].asStr()
    )
  }

  private fun buildSearchResultItem(m: Map<String, Any?>): SearchResultItem {
    val stafflistRaw = m["stafflist"] as? List<*>
    return SearchResultItem(
      subjectId = m["subject_id"].asStr(),
      subjectType = subjectTypeFrom(m["subject_type"]),
      title = m["title"].asStr(),
      description = m["description"].asStrOrNull(),
      releaseDate = m["release_date"].asStrOrNull(),
      duration = m["duration"].asDoubleOrNull(),
      genre = m["genre"].asList().map { it.asStr() }.toTypedArray(),
      cover = buildContentImage(m["cover"].asMapOrNull()),
      countryName = m["country_name"].asStrOrNull(),
      imdbRatingValue = m["imdb_rating_value"].asDoubleOrNull(),
      detailPath = m["detail_path"].asStr(),
      hasResource = m["has_resource"].asBool(),
      subtitles = m["subtitles"].asList().map { it.asStr() }.toTypedArray(),
      corner = m["corner"].asStrOrNull(),
      stafflist = stafflistRaw?.map { AnyMap.fromMap((it as? Map<String, Any?>) ?: emptyMap(), true) }?.toTypedArray(),
      appointmentCnt = m["appointment_cnt"].asDoubleOrNull(),
      appointmentDate = m["appointment_date"].asStrOrNull()
    )
  }

  private fun buildSearchResultsPager(m: Map<String, Any?>?): SearchResultsPager {
    val pm = m ?: emptyMap()
    val nextPageRaw = pm["next_page"]
    val nextPage = if (nextPageRaw == null) null else Variant_NullType_Double.create(nextPageRaw.asDouble())
    return SearchResultsPager(
      hasMore = pm["has_more"].asBool(), nextPage = nextPage,
      page = pm["page"].asDouble(), perPage = pm["per_page"].asDouble(), totalCount = pm["total_count"].asDouble()
    )
  }

  private fun buildSearchResults(m: Map<String, Any?>): SearchResults {
    val items = m["items"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    return SearchResults(items = items, pager = buildSearchResultsPager(m["pager"].asMapOrNull()), query = m["query"].asStr(), version = apiVersionFrom(m["version"]))
  }

  private fun buildSuggestedItem(m: Map<String, Any?>): SuggestedItem {
    val subjectRaw = m["subject"]
    val subject = if (subjectRaw == null) null else Variant_NullType_String.create(subjectRaw.asStr())
    val typeRaw = m["type"]
    return SuggestedItem(type = if (typeRaw == null) null else subjectTypeFrom(typeRaw), subject = subject, word = m["word"].asStr())
  }

  private fun buildSearchSuggestions(m: Map<String, Any?>): SearchSuggestions {
    val items = m["items"].asList().map { buildSuggestedItem(it.asMap()) }.toTypedArray()
    return SearchSuggestions(items = items, keyword = m["keyword"].asStr(), version = apiVersionFrom(m["version"]))
  }

  private fun buildTrendingResults(m: Map<String, Any?>): TrendingResults {
    val data = m["data"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    return TrendingResults(data = data, pager = buildSearchResultsPager(m["pager"].asMapOrNull()), version = apiVersionFrom(m["version"]))
  }

  private fun buildContentCategory(m: Map<String, Any?>): ContentCategory {
    val subjects = m["subjects"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    return ContentCategory(type = m["type"].asStr(), position = m["position"].asDouble(), title = m["title"].asStr(), subjects = subjects, url = m["url"].asStrOrNull(), opId = m["op_id"].asStrOrNull())
  }

  private fun buildPlatformInfo(m: Map<String, Any?>): PlatformInfo = PlatformInfo(name = m["name"].asStr(), uploadBy = m["upload_by"].asStr())

  private fun buildHomepageContent(m: Map<String, Any?>): HomepageContent {
    val categories = m["categories"].asList().map { buildContentCategory(it.asMap()) }.toTypedArray()
    val platformList = m["platform_list"].asList().map { buildPlatformInfo(it.asMap()) }.toTypedArray()
    return HomepageContent(categories = categories, platformList = platformList, version = apiVersionFrom(m["version"]))
  }

  private fun buildHotContent(m: Map<String, Any?>): HotContent {
    val movies = m["movies"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    val tvSeries = m["tv_series"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    return HotContent(movies = movies, tvSeries = tvSeries, version = apiVersionFrom(m["version"]))
  }

  private fun buildPopularSearchItem(m: Map<String, Any?>): PopularSearchItem = PopularSearchItem(title = m["title"].asStr())

  private fun buildPopularSearches(m: Map<String, Any?>): PopularSearches {
    val data = m["data"].asList().map { buildPopularSearchItem(it.asMap()) }.toTypedArray()
    return PopularSearches(data = data, version = apiVersionFrom(m["version"]))
  }

  private fun buildStarsModel(m: Map<String, Any?>): StarsModel = StarsModel(
    avatarUrl = m["avatar_url"].asStr(), character = m["character"].asStr(), detailPath = m["detail_path"].asStr(),
    name = m["name"].asStr(), staffId = m["staff_id"].asStr(), staffType = m["staff_type"].asDouble()
  )

  private fun buildResourceModel(m: Map<String, Any?>?): ResourceModel {
    val rm = m ?: emptyMap()
    val seasons = rm["seasons"].asList().map { AnyMap.fromMap((it as? Map<String, Any?>) ?: emptyMap(), true) }.toTypedArray()
    return ResourceModel(seasons = seasons, source = rm["source"].asStr(), uploadBy = rm["upload_by"].asStr())
  }

  private fun buildMetadataModel(m: Map<String, Any?>?): MetadataModel {
    val mm = m ?: emptyMap()
    return MetadataModel(
      description = mm["description"].asStr(), image = mm["image"].asStr(),
      keyWords = mm["key_words"].asList().map { it.asStr() }.toTypedArray(),
      referer = mm["referer"].asStrOrNull(), title = mm["title"].asStr(), url = mm["url"].asStrOrNull()
    )
  }

  private fun buildPostListItem(m: Map<String, Any?>): PostListItem = PostListItem(id = m["id"].asStr(), title = m["title"].asStr(), content = m["content"].asStr(), createTime = m["create_time"].asStr())

  private fun buildPostList(m: Map<String, Any?>?): PostList {
    val pm = m ?: emptyMap()
    val items = pm["items"].asList().map { buildPostListItem(it.asMap()) }.toTypedArray()
    return PostList(items = items, pager = buildSearchResultsPager(pm["pager"].asMapOrNull()))
  }

  private fun buildMovieDetails(m: Map<String, Any?>): MovieDetails = MovieDetails(
    subject = buildSearchResultItem(m["subject"].asMap()),
    stars = m["stars"].asList().map { buildStarsModel(it.asMap()) }.toTypedArray(),
    resource = buildResourceModel(m["resource"].asMapOrNull()),
    metadata = buildMetadataModel(m["metadata"].asMapOrNull()),
    postList = buildPostList(m["post_list"].asMapOrNull()),
    isForbid = m["is_forbid"].asBool(), watchTimeLimit = m["watch_time_limit"].asDouble(), version = apiVersionFrom(m["version"])
  )

  private fun buildTVSeriesDetails(m: Map<String, Any?>): TVSeriesDetails = TVSeriesDetails(
    subject = buildSearchResultItem(m["subject"].asMap()),
    stars = m["stars"].asList().map { buildStarsModel(it.asMap()) }.toTypedArray(),
    resource = buildResourceModel(m["resource"].asMapOrNull()),
    metadata = buildMetadataModel(m["metadata"].asMapOrNull()),
    postList = buildPostList(m["post_list"].asMapOrNull()),
    version = apiVersionFrom(m["version"])
  )

  private fun buildV2ItemDetails(m: Map<String, Any?>): V2ItemDetails = V2ItemDetails(
    subject = buildSearchResultItem(m["subject"].asMap()),
    stars = m["stars"].asList().map { buildStarsModel(it.asMap()) }.toTypedArray(),
    resource = buildResourceModel(m["resource"].asMapOrNull()),
    metadata = buildMetadataModel(m["metadata"].asMapOrNull()),
    isForbid = m["is_forbid"].asBool(), watchTimeLimit = m["watch_time_limit"].asDouble(), version = apiVersionFrom(m["version"])
  )

  private fun buildMediaFile(m: Map<String, Any?>): MediaFile = MediaFile(id = m["id"].asStr(), url = m["url"].asStr(), resolution = m["resolution"].asDouble(), size = m["size"].asDouble())

  private fun buildCaptionFile(m: Map<String, Any?>): CaptionFile = CaptionFile(
    id = m["id"].asStr(), lan = m["lan"].asStr(), lanName = m["lan_name"].asStr(),
    url = m["url"].asStr(), size = m["size"].asDouble(), delay = m["delay"].asDouble()
  )

  private fun buildDownloadableFiles(m: Map<String, Any?>): DownloadableFiles = DownloadableFiles(
    downloads = m["downloads"].asList().map { buildMediaFile(it.asMap()) }.toTypedArray(),
    captions = m["captions"].asList().map { buildCaptionFile(it.asMap()) }.toTypedArray(),
    limited = m["limited"].asBool(), limitedCode = m["limited_code"].asStrOrNull(), hasResource = m["has_resource"].asBool()
  )

  private fun buildDownloadedFile(m: Map<String, Any?>?): DownloadedFile? {
    if (m == null) return null
    return DownloadedFile(savedTo = m["saved_to"].asStr(), size = m["size"].asDouble())
  }

  private fun buildDownloadMovieResult(m: Map<String, Any?>): DownloadMovieResult {
    val movieFile = buildDownloadedFile(m["movie_file"].asMapOrNull()) ?: DownloadedFile(savedTo = "", size = 0.0)
    val subtitleRaw = m["subtitle_file"].asMapOrNull()
    val subtitleFile = if (subtitleRaw == null) null else Variant_NullType_DownloadedFile.create(buildDownloadedFile(subtitleRaw)!!)
    return DownloadMovieResult(movieFile = movieFile, subtitleFile = subtitleFile)
  }

  private fun buildEpisodeDownload(m: Map<String, Any?>): EpisodeDownload = EpisodeDownload(savedTo = m["saved_to"].asStr(), size = m["size"].asDouble())

  private fun buildDownloadTVSeriesResult(m: Map<String, Any?>): DownloadTVSeriesResult {
    val episodesRaw = m["episodes"].asMap()
    val episodes = episodesRaw.mapValues { (_, v) -> buildEpisodeDownload((v as? Map<String, Any?>) ?: emptyMap()) }
    return DownloadTVSeriesResult(episodes = episodes, total = m["total"].asDouble())
  }

  private fun buildDownloadStatus(m: Map<String, Any?>): DownloadStatus = DownloadStatus(
    downloadId = m["download_id"].asStr(), downloadedSize = m["downloaded_size"].asDouble(), expectedSize = m["expected_size"].asDouble(),
    percent = m["percent"].asDouble(), isComplete = m["is_complete"].asBool(), savedTo = m["saved_to"].asStrOrNull()
  )

  private fun buildDownloadStatusList(m: Map<String, Any?>): DownloadStatusList {
    val data = m["data"].asList().map { buildDownloadStatus(it.asMap()) }.toTypedArray()
    return DownloadStatusList(data = data)
  }

  private fun buildRecommendations(m: Map<String, Any?>): Recommendations {
    val data = m["data"].asList().map { buildSearchResultItem(it.asMap()) }.toTypedArray()
    return Recommendations(data = data, pager = buildSearchResultsPager(m["pager"].asMapOrNull()), version = apiVersionFrom(m["version"]))
  }

  private fun buildEngineStatus(m: Map<String, Any?>): EngineStatus = EngineStatus(
    status = m["status"].asStr(), running = m["running"].asBool(), defaultVersion = apiVersionFrom(m["default_version"]), timestamp = m["timestamp"].asStr()
  )

  private fun buildCommandResult(m: Map<String, Any?>): CommandResult {
    val dataRaw = m["data"].asMapOrNull()
    return CommandResult(
      success = m["success"].asBool(), data = if (dataRaw == null) null else AnyMap.fromMap(dataRaw, true),
      error = m["error"].asStrOrNull(), message = m["message"].asStrOrNull(), timestamp = m["timestamp"].asStrOrNull()
    )
  }

  private fun searchResultItemToMap(item: SearchResultItem): Map<String, Any?> = mapOf(
    "subject_id" to item.subjectId, "subject_type" to item.subjectType.name, "title" to item.title,
    "description" to item.description, "release_date" to item.releaseDate, "duration" to item.duration,
    "genre" to item.genre.toList(), "country_name" to item.countryName, "imdb_rating_value" to item.imdbRatingValue,
    "detail_path" to item.detailPath, "has_resource" to item.hasResource, "subtitles" to item.subtitles.toList(),
    "corner" to item.corner, "appointment_cnt" to item.appointmentCnt, "appointment_date" to item.appointmentDate
  )
}
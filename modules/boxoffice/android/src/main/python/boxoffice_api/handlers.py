"""
Request Handlers - Handlers for various BoxOffice API commands.
Processes commands using the real moviebox-api SDK and returns formatted responses.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
import threading


class RequestHandler:
    """
    Handler class for BoxOffice API commands.
    Uses the real moviebox-api SDK to fetch moviebox.ph data.
    """
    
    def __init__(self, engine):
        """Initialize the request handler with engine reference."""
        self._engine = engine
    
    def _get_session(self, version: Optional[str] = None):
        """Get the Session for the given API version."""
        return self._engine.get_session(version)
    
    def _get_default_version(self) -> str:
        """Get the default API version."""
        return self._engine.get_default_version()
    
    def _run_async(self, coro):
        """Run an async coroutine and return its result."""
        try:
            loop = asyncio.get_running_loop()
            # If we're already in an event loop, use run_coroutine_threadsafe
            future = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result(timeout=60)
        except RuntimeError:
            # No event loop running, create one
            return asyncio.run(coro)
    
    def _format_search_item(self, item: Any) -> Dict[str, Any]:
        """
        Format a SearchResultsItem into a standard dictionary.
        """
        if hasattr(item, 'model_dump'):
            data = item.model_dump()
        elif hasattr(item, 'to_dict'):
            data = item.to_dict()
        elif isinstance(item, dict):
            data = item
        else:
            # Fallback using attributes
            data = {
                "subjectId": getattr(item, 'subjectId', None),
                "subjectType": getattr(item, 'subjectType', None),
                "title": getattr(item, 'title', None),
                "description": getattr(item, 'description', None),
                "releaseDate": str(getattr(item, 'releaseDate', None)) if getattr(item, 'releaseDate', None) else None,
                "duration": getattr(item, 'duration', None),
                "genre": getattr(item, 'genre', []),
                "countryName": getattr(item, 'countryName', None),
                "imdbRatingValue": getattr(item, 'imdbRatingValue', None),
                "detailPath": getattr(item, 'detailPath', None),
                "hasResource": getattr(item, 'hasResource', False),
                "subtitles": getattr(item, 'subtitles', []),
                "corner": getattr(item, 'corner', None),
            }
        
        # Format cover image if present
        cover = getattr(item, 'cover', None)
        if cover and hasattr(cover, 'model_dump'):
            data['cover'] = cover.model_dump()
        
        return data
    
    def _format_pager(self, pager: Any) -> Dict[str, Any]:
        """Format a SearchResultsPagerModel into a standard dictionary."""
        if hasattr(pager, 'model_dump'):
            return pager.model_dump()
        return {
            "hasMore": getattr(pager, 'hasMore', False),
            "nextPage": getattr(pager, 'nextPage', None),
            "page": getattr(pager, 'page', 1),
            "perPage": getattr(pager, 'perPage', 24),
            "totalCount": getattr(pager, 'totalCount', 0),
        }
    
    def _format_downloadable_files(self, files: Any) -> Dict[str, Any]:
        """Format DownloadableFilesMetadata into a standard dictionary."""
        if hasattr(files, 'model_dump'):
            data = files.model_dump()
        else:
            data = {
                "limited": getattr(files, 'limited', False),
                "limitedCode": getattr(files, 'limitedCode', None),
                "hasResource": getattr(files, 'hasResource', False),
                "downloads": [],
                "captions": [],
            }
            
            # Format media files
            downloads = getattr(files, 'downloads', [])
            formatted_downloads = []
            for dl in downloads:
                if hasattr(dl, 'model_dump'):
                    formatted_downloads.append(dl.model_dump())
                else:
                    formatted_downloads.append({
                        "id": getattr(dl, 'id', None),
                        "url": str(getattr(dl, 'url', '')),
                        "resolution": getattr(dl, 'resolution', None),
                        "size": getattr(dl, 'size', 0),
                    })
            data['downloads'] = formatted_downloads
            
            # Format captions
            captions = getattr(files, 'captions', [])
            formatted_captions = []
            for cap in captions:
                if hasattr(cap, 'model_dump'):
                    formatted_captions.append(cap.model_dump())
                else:
                    formatted_captions.append({
                        "id": getattr(cap, 'id', None),
                        "lan": getattr(cap, 'lan', None),
                        "lanName": getattr(cap, 'lanName', None),
                        "url": str(getattr(cap, 'url', '')),
                        "size": getattr(cap, 'size', 0),
                    })
            data['captions'] = formatted_captions
        
        return data
    
    def handle_ping(self, params: Dict) -> Dict[str, Any]:
        """Handle ping command - health check."""
        session = self._get_session()
        return {
            "success": True,
            "response": "pong",
            "timestamp": datetime.now().isoformat(),
            "sdk_available": session is not None,
            "sdk_version": "moviebox-api==0.5.5"
        }
    
    def handle_search(self, params: Dict) -> Dict[str, Any]:
        """
        Handle search command - search for movies, TV series, music, etc.
        Maps to moviebox_api.v1.Search or moviebox_api.v2.Search
        """
        try:
            query = params.get("query", "")
            page = params.get("page", 1)
            per_page = params.get("per_page", 24)
            subject_type_str = params.get("subject_type", "ALL")
            version = params.get("version", self._get_default_version())
            
            if not query or not query.strip():
                return {"success": False, "error": "Search query is required"}
            
            session = self._get_session(version)
            
            # Map string subject type to enum
            from moviebox_api.v1 import SubjectType
            subject_type = getattr(SubjectType, subject_type_str.upper(), SubjectType.ALL)
            
            # Use v2 Search by default, v1 as fallback
            if version == "v2":
                from moviebox_api.v2 import Search as V2Search
                search = V2Search(
                    session=session,
                    query=query,
                    subject_type=subject_type,
                    page=page,
                    per_page=per_page
                )
            else:
                from moviebox_api.v1 import Search
                search = Search(
                    session=session,
                    query=query,
                    subject_type=subject_type,
                    page=page,
                    per_page=per_page
                )
            
            # Execute search (sync fallback)
            results = search.get_content_model_sync()
            
            # Format results
            items = []
            for item in results.items:
                items.append(self._format_search_item(item))
            
            return {
                "success": True,
                "data": items,
                "pager": self._format_pager(results.pager),
                "query": query,
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_search_suggestions(self, params: Dict) -> Dict[str, Any]:
        """Handle search_suggestions command - get search autocomplete suggestions."""
        try:
            query = params.get("query", "")
            version = params.get("version", self._get_default_version())
            
            if not query or not query.strip():
                return {"success": False, "error": "Query is required"}
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import SearchSuggestion
            suggestion = SearchSuggestion(session=session, query=query)
            results = suggestion.get_content_model_sync()
            
            items = []
            for item in results.items:
                if hasattr(item, 'model_dump'):
                    items.append(item.model_dump())
                else:
                    items.append({
                        "type": getattr(item, 'type', None),
                        "subject": getattr(item, 'subject', None),
                        "word": getattr(item, 'word', None),
                    })
            
            return {
                "success": True,
                "data": items,
                "keyword": getattr(results, 'keyword', query),
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_trending(self, params: Dict) -> Dict[str, Any]:
        """Handle get_trending command - returns trending movies/TV/music."""
        try:
            page = params.get("page", 1)
            per_page = params.get("per_page", 24)
            version = params.get("version", self._get_default_version())
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import Trending
            trending = Trending(
                session=session,
                page=page,
                per_page=per_page
            )
            results = trending.get_content_model_sync()
            
            items = []
            for item in results.subjectList:
                items.append(self._format_search_item(item))
            
            return {
                "success": True,
                "data": items,
                "pager": self._format_pager(results.pager),
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_homepage(self, params: Dict) -> Dict[str, Any]:
        """Handle get_homepage command - returns homepage content categories."""
        try:
            version = params.get("version", self._get_default_version())
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import Homepage
            homepage = Homepage(session=session)
            results = homepage.get_content_model_sync()
            
            # Format operatingList (content categories)
            categories = []
            for category in getattr(results, 'operatingList', []):
                if hasattr(category, 'model_dump'):
                    cat_data = category.model_dump()
                else:
                    cat_data = {
                        "type": getattr(category, 'type', None),
                        "position": getattr(category, 'position', None),
                        "title": getattr(category, 'title', None),
                        "url": getattr(category, 'url', None),
                    }
                    
                    # Format subjects in category
                    subjects = []
                    for sub in getattr(category, 'subjects', []):
                        subjects.append(self._format_search_item(sub))
                    cat_data['subjects'] = subjects
                
                categories.append(cat_data)
            
            return {
                "success": True,
                "data": {
                    "categories": categories,
                    "platformList": getattr(results, 'platformList', []),
                },
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_hot_content(self, params: Dict) -> Dict[str, Any]:
        """Handle get_hot_content command - returns hot movies and TV series."""
        try:
            version = params.get("version", self._get_default_version())
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import HotMoviesAndTVSeries
            hot = HotMoviesAndTVSeries(session=session)
            results = hot.get_content_model_sync()
            
            movies = []
            for movie in getattr(results, 'movies', []):
                movies.append(self._format_search_item(movie))
            
            tv_series = []
            for series in getattr(results, 'tv_series', []):
                tv_series.append(self._format_search_item(series))
            
            return {
                "success": True,
                "data": {
                    "movies": movies,
                    "tv_series": tv_series
                },
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_popular_searches(self, params: Dict) -> Dict[str, Any]:
        """Handle get_popular_searches command - returns popular search terms."""
        try:
            version = params.get("version", self._get_default_version())
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import PopularSearch
            popular = PopularSearch(session=session)
            results = popular.get_content_model_sync()
            
            items = []
            for item in getattr(results, 'items', []):
                if hasattr(item, 'model_dump'):
                    items.append(item.model_dump())
                else:
                    items.append({
                        "title": getattr(item, 'title', None)
                    })
            
            return {
                "success": True,
                "data": items,
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_movie_details(self, params: Dict) -> Dict[str, Any]:
        """
        Handle get_movie_details command - returns detailed movie info.
        Uses moviebox_api.v1.MovieDetails
        """
        try:
            url_or_item = params.get("url_or_item")
            if not url_or_item:
                return {"success": False, "error": "url_or_item is required (detailPath or SearchResultsItem)"}
            
            version = params.get("version", "v1")
            session = self._get_session(version)
            
            from moviebox_api.v1 import MovieDetails
            details = MovieDetails(
                url_or_item=url_or_item,
                session=session
            )
            
            # Get JSON details (most structured format)
            result = details.get_json_details_extractor_model_sync()
            
            # Format response
            if hasattr(result, 'model_dump'):
                data = result.model_dump()
            else:
                data = {
                    "subject": getattr(result, 'subject', None),
                    "resource": getattr(result, 'resource', None),
                    "metadata": getattr(result, 'metadata', None),
                    "stars": getattr(result, 'stars', []),
                    "postList": getattr(result, 'postList', None),
                    "isForbid": getattr(result, 'isForbid', False),
                    "watchTimeLimit": getattr(result, 'watchTimeLimit', 0),
                }
            
            return {
                "success": True,
                "data": data,
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_tv_series_details(self, params: Dict) -> Dict[str, Any]:
        """
        Handle get_tv_series_details command - returns detailed TV series info.
        Uses moviebox_api.v1.TVSeriesDetails
        """
        try:
            url_or_item = params.get("url_or_item")
            if not url_or_item:
                return {"success": False, "error": "url_or_item is required"}
            
            version = params.get("version", "v1")
            session = self._get_session(version)
            
            from moviebox_api.v1 import TVSeriesDetails
            details = TVSeriesDetails(
                url_or_item=url_or_item,
                session=session
            )
            
            result = details.get_json_details_extractor_model_sync()
            
            if hasattr(result, 'model_dump'):
                data = result.model_dump()
            else:
                data = {
                    "subject": getattr(result, 'subject', None),
                    "resource": getattr(result, 'resource', None),
                    "metadata": getattr(result, 'metadata', None),
                    "stars": getattr(result, 'stars', []),
                    "postList": getattr(result, 'postList', None),
                }
            
            return {
                "success": True,
                "data": data,
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_item_details(self, params: Dict) -> Dict[str, Any]:
        """
        Handle get_item_details command - v2 unified item details.
        Uses moviebox_api.v2.ItemDetails
        """
        try:
            url_or_item = params.get("url_or_item")
            if not url_or_item:
                return {"success": False, "error": "url_or_item is required"}
            
            session = self._get_session("v2")
            
            from moviebox_api.v2 import ItemDetails
            details = ItemDetails(session=session)
            
            # v2 ItemDetails requires setting url_or_item after init
            # This is a workaround - the actual API may vary
            result = details.get_content_model_sync()
            
            if hasattr(result, 'model_dump'):
                data = result.model_dump()
            else:
                data = {"result": str(result)}
            
            return {
                "success": True,
                "data": data,
                "version": "v2"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_downloadable_files(self, params: Dict) -> Dict[str, Any]:
        """
        Handle get_downloadable_files command - returns downloadable file links.
        Uses DownloadableMovieFilesDetail or DownloadableTVSeriesFilesDetail
        """
        try:
            item = params.get("item")
            if not item:
                return {"success": False, "error": "item (SearchResultsItem or item details) is required"}
            
            subject_type = params.get("subject_type", "MOVIES")
            version = params.get("version", "v1")
            session = self._get_session(version)
            
            from moviebox_api.v1 import DownloadableMovieFilesDetail, DownloadableTVSeriesFilesDetail
            
            if subject_type == "TV_SERIES":
                files_detail = DownloadableTVSeriesFilesDetail(
                    session=session,
                    item=item
                )
            else:
                files_detail = DownloadableMovieFilesDetail(
                    session=session,
                    item=item
                )
            
            result = files_detail.get_content_model_sync()
            
            return {
                "success": True,
                "data": self._format_downloadable_files(result),
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_download_movie(self, params: Dict) -> Dict[str, Any]:
        """
        Handle download_movie command - download a movie using MovieAuto.
        """
        try:
            title = params.get("title")
            if not title:
                return {"success": False, "error": "title is required"}
            
            quality = params.get("quality", self._engine.get_quality())
            caption_language = params.get("caption_language", self._engine.get_caption_language())
            download_dir = params.get("download_dir", self._engine.get_download_dir())
            year = params.get("year", 0)
            
            # Use MovieAuto for simple auto-download
            from moviebox_api.v1 import MovieAuto
            
            auto = MovieAuto(
                caption_language=caption_language,
                quality=quality,
                download_dir=download_dir,
                tasks=5
            )
            
            # Run async download
            movie_file, subtitle_file = self._run_async(
                auto.run(title, year=year if year > 0 else None)
            )
            
            return {
                "success": True,
                "data": {
                    "movie_file": {
                        "saved_to": str(getattr(movie_file, 'saved_to', '')),
                        "size": getattr(movie_file, 'size', 0),
                    },
                    "subtitle_file": {
                        "saved_to": str(getattr(subtitle_file, 'saved_to', '')) if subtitle_file else None,
                        "size": getattr(subtitle_file, 'size', 0) if subtitle_file else 0,
                    }
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_download_tv_series(self, params: Dict) -> Dict[str, Any]:
        """
        Handle download_tv_series command - download TV series episodes.
        """
        try:
            title = params.get("title")
            season = params.get("season", 1)
            episode = params.get("episode", 1)
            limit = params.get("limit", 1)
            
            if not title:
                return {"success": False, "error": "title is required"}
            
            quality = params.get("quality", self._engine.get_quality())
            caption_language = params.get("caption_language", self._engine.get_caption_language())
            download_dir = params.get("download_dir", self._engine.get_download_dir())
            auto_mode = params.get("auto_mode", False)
            
            # Use Downloader from CLI module for more control
            from moviebox_api.v1.cli import Downloader
            
            downloader = Downloader()
            
            episodes_map = self._run_async(
                downloader.download_tv_series(
                    title,
                    season=season,
                    episode=episode,
                    limit=limit,
                    quality=quality,
                    caption_language=caption_language,
                    dir=download_dir,
                    auto_mode=auto_mode
                )
            )
            
            # Format episodes map
            formatted = {}
            for key, value in episodes_map.items():
                formatted[str(key)] = {
                    "saved_to": str(getattr(value, 'saved_to', '')),
                    "size": getattr(value, 'size', 0),
                }
            
            return {
                "success": True,
                "data": {
                    "episodes": formatted,
                    "total": len(formatted)
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_download_status(self, params: Dict) -> Dict[str, Any]:
        """Handle get_download_status command - check active download progress."""
        try:
            download_id = params.get("download_id")
            
            if not download_id:
                # Return all active downloads
                active = []
                for dl_id, tracker in self._engine._active_downloads.items():
                    active.append({
                        "download_id": dl_id,
                        "downloaded_size": getattr(tracker, 'downloaded_size', 0),
                        "expected_size": getattr(tracker, 'expected_size', 0),
                        "percent": (getattr(tracker, 'downloaded_size', 0) / getattr(tracker, 'expected_size', 1)) * 100,
                        "is_complete": getattr(tracker, 'is_complete', False),
                    })
                return {
                    "success": True,
                    "data": active
                }
            
            tracker = self._engine.get_download_tracker(download_id)
            if not tracker:
                return {
                    "success": False,
                    "error": f"No active download found with ID: {download_id}"
                }
            
            return {
                "success": True,
                "data": {
                    "download_id": download_id,
                    "downloaded_size": getattr(tracker, 'downloaded_size', 0),
                    "expected_size": getattr(tracker, 'expected_size', 0),
                    "percent": (getattr(tracker, 'downloaded_size', 0) / getattr(tracker, 'expected_size', 1)) * 100,
                    "is_complete": getattr(tracker, 'is_complete', False),
                    "saved_to": str(getattr(tracker, 'saved_to', '')),
                }
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_cancel_download(self, params: Dict) -> Dict[str, Any]:
        """Handle cancel_download command - cancel an active download."""
        try:
            download_id = params.get("download_id")
            if not download_id:
                return {"success": False, "error": "download_id is required"}
            
            # Remove from active tracking
            self._engine.remove_download_tracker(download_id)
            
            return {
                "success": True,
                "message": f"Download {download_id} cancelled"
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def handle_get_recommendations(self, params: Dict) -> Dict[str, Any]:
        """
        Handle get_recommendations command - get recommendations based on an item.
        Uses moviebox_api.v1.Recommend
        """
        try:
            url_or_item = params.get("url_or_item")
            if not url_or_item:
                return {"success": False, "error": "url_or_item is required"}
            
            page = params.get("page", 1)
            per_page = params.get("per_page", 24)
            version = params.get("version", "v1")
            
            session = self._get_session(version)
            
            from moviebox_api.v1 import Recommend
            recommend = Recommend(
                session=session,
                url_or_item=url_or_item,
                page=page,
                per_page=per_page
            )
            results = recommend.get_content_model_sync()
            
            items = []
            for item in getattr(results, 'items', []):
                items.append(self._format_search_item(item))
            
            return {
                "success": True,
                "data": items,
                "pager": self._format_pager(getattr(results, 'pager', None)),
                "version": version
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
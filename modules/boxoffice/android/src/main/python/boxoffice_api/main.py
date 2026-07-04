"""
BoxOffice Engine - Core Python engine for the BoxOffice module.
Manages the lifecycle, state, and operations of the moviebox.ph backend.
Uses the real moviebox-api SDK (moviebox_api v1/v2).
"""

import json
import logging
import threading
import asyncio
from typing import Dict, Any, Optional, Callable
from datetime import datetime
from enum import Enum
import sys
import os

# Real moviebox-api SDK imports
try:
    from moviebox_api.v1 import (
        MovieAuto,
        Search,
        MovieDetails,
        TVSeriesDetails,
        DownloadableMovieFilesDetail,
        DownloadableTVSeriesFilesDetail,
        MediaFileDownloader,
        DownloadTracker,
        Session,
        Trending,
        Homepage,
        PopularSearch,
        HotMoviesAndTVSeries,
        Recommend,
        SearchSuggestion,
        SubjectType,
    )
    from moviebox_api.v2 import (
        Search as V2Search,
        ItemDetails as V2ItemDetails,
        Homepage as V2Homepage,
        Session as V2Session,
    )
    from moviebox_api.v1.models import (
        SearchResultsModel,
        SearchResultsItem,
        DownloadableFilesMetadata,
        MediaFileMetadata,
        CaptionFileMetadata,
        TrendingResultsModel,
        HomepageContentModel,
        HotMoviesAndTVSeriesModel,
        PopularSearchModel,
        ContentCategoryModel,
    )
except ImportError as e:
    raise ImportError(
        f"moviebox-api package is required. Install with: pip install 'moviebox-api==0.5.5'. Error: {e}"
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("BoxOfficeEngine")


class EngineStatus(Enum):
    """Engine status enumeration."""
    IDLE = "idle"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    INITIALIZING = "initializing"


class BoxOfficeEngine:
    """
    Core engine class for the BoxOffice API.
    Manages the Python backend lifecycle and operations.
    Uses real moviebox-api SDK v1/v2 for moviebox.ph operations.
    """
    
    _instance: Optional['BoxOfficeEngine'] = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Singleton pattern implementation."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(BoxOfficeEngine, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        """Initialize the engine instance."""
        if hasattr(self, '_initialized') and self._initialized:
            return
        
        self._initialized = True
        self._status = EngineStatus.IDLE
        self._handlers: Dict[str, Callable] = {}
        self._event_callbacks: Dict[str, list] = {}
        self._engine_thread: Optional[threading.Thread] = None
        self._running = False
        self._data_cache: Dict[str, Any] = {}
        self._engine_config: Dict[str, Any] = {}
        
        # Real SDK session objects
        self._v1_session: Optional[Session] = None
        self._v2_session: Optional[V2Session] = None
        
        # Active download trackers for progress reporting
        self._active_downloads: Dict[str, DownloadTracker] = {}
        
        # Default API version
        self._default_version: str = "v2"
        
        # Register default handlers
        self._register_default_handlers()
        
        logger.info("BoxOffice Engine initialized")
    
    def _get_session(self, version: Optional[str] = None):
        """Get the appropriate Session for the given API version."""
        ver = version or self._default_version
        
        if ver == "v1":
            if not self._v1_session:
                self._v1_session = Session()
            return self._v1_session
        elif ver == "v2":
            if not self._v2_session:
                self._v2_session = V2Session()
            return self._v2_session
        else:
            # Default to v2
            if not self._v2_session:
                self._v2_session = V2Session()
            return self._v2_session
    
    def _register_default_handlers(self):
        """Register default command handlers mapped to real SDK."""
        from .handlers import RequestHandler
        handler = RequestHandler(self)
        
        self._handlers = {
            # Health check
            "ping": handler.handle_ping,
            
            # Search commands
            "search": handler.handle_search,
            "search_suggestions": handler.handle_search_suggestions,
            
            # Discovery commands
            "get_trending": handler.handle_get_trending,
            "get_homepage": handler.handle_get_homepage,
            "get_hot_content": handler.handle_get_hot_content,
            "get_popular_searches": handler.handle_get_popular_searches,
            
            # Details commands
            "get_movie_details": handler.handle_get_movie_details,
            "get_tv_series_details": handler.handle_get_tv_series_details,
            "get_item_details": handler.handle_get_item_details,
            
            # Downloadable files commands
            "get_downloadable_files": handler.handle_get_downloadable_files,
            
            # Download commands
            "download_movie": handler.handle_download_movie,
            "download_tv_series": handler.handle_download_tv_series,
            "get_download_status": handler.handle_get_download_status,
            "cancel_download": handler.handle_cancel_download,
            
            # Recommendations
            "get_recommendations": handler.handle_get_recommendations,
        }
        logger.info(f"Registered {len(self._handlers)} handlers")
    
    def configure(self, config: Dict[str, Any]) -> bool:
        """
        Configure the engine with provided settings.
        
        Args:
            config: Configuration dictionary
            
        Returns:
            bool: True if configuration was successful
        """
        try:
            self._engine_config.update(config)
            
            # Set default API version
            self._default_version = config.get('api_version', 'v2')
            
            # Configure download directory
            self._download_dir = config.get('download_dir', os.path.expanduser('~/Downloads'))
            
            # Configure subtitle language
            self._caption_language = config.get('caption_language', 'English')
            
            # Configure default quality
            self._quality = config.get('quality', 'best')
            
            # Initialize sessions
            self._v1_session = Session()
            self._v2_session = V2Session()
            
            logger.info(f"Engine configured with version={self._default_version}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to configure engine: {str(e)}")
            return False
    
    def get_session(self, version: Optional[str] = None):
        """Get the Session for the given API version."""
        return self._get_session(version)
    
    def get_default_version(self) -> str:
        """Get the default API version."""
        return self._default_version
    
    def get_download_dir(self) -> str:
        """Get the configured download directory."""
        return self._engine_config.get('download_dir', os.path.expanduser('~/Downloads'))
    
    def get_caption_language(self) -> str:
        """Get the configured caption language."""
        return self._engine_config.get('caption_language', 'English')
    
    def get_quality(self) -> str:
        """Get the configured default quality."""
        return self._engine_config.get('quality', 'best')
    
    def start(self) -> Dict[str, Any]:
        """
        Start the BoxOffice engine.
        
        Returns:
            Dict containing status and message
        """
        try:
            if self._status == EngineStatus.RUNNING:
                return {
                    "success": True,
                    "status": "already_running",
                    "message": "Engine is already running"
                }
            
            self._status = EngineStatus.INITIALIZING
            logger.info("Starting BoxOffice Engine...")
            
            # Initialize sessions if not already done
            if not self._v1_session:
                self._v1_session = Session()
            if not self._v2_session:
                self._v2_session = V2Session()
            
            self._running = True
            self._status = EngineStatus.RUNNING
            
            # Trigger event
            self._emit_event("onStatusChange", {
                "status": self._status.value,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info("BoxOffice Engine started successfully")
            return {
                "success": True,
                "status": self._status.value,
                "message": "Engine started successfully"
            }
            
        except Exception as e:
            self._status = EngineStatus.ERROR
            logger.error(f"Failed to start engine: {str(e)}")
            return {
                "success": False,
                "status": self._status.value,
                "error": str(e)
            }
    
    def stop(self) -> Dict[str, Any]:
        """
        Stop the BoxOffice engine.
        
        Returns:
            Dict containing status and message
        """
        try:
            if self._status == EngineStatus.STOPPED:
                return {
                    "success": True,
                    "status": "already_stopped",
                    "message": "Engine is already stopped"
                }
            
            logger.info("Stopping BoxOffice Engine...")
            self._running = False
            self._status = EngineStatus.STOPPED
            
            # Clear active downloads
            self._active_downloads.clear()
            
            # Wait for thread to finish if running
            if self._engine_thread and self._engine_thread.is_alive():
                self._engine_thread.join(timeout=5.0)
            
            # Trigger event
            self._emit_event("onStatusChange", {
                "status": self._status.value,
                "timestamp": datetime.now().isoformat()
            })
            
            logger.info("BoxOffice Engine stopped successfully")
            return {
                "success": True,
                "status": self._status.value,
                "message": "Engine stopped successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to stop engine: {str(e)}")
            return {
                "success": False,
                "status": self._status.value,
                "error": str(e)
            }
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current engine status.
        
        Returns:
            Dict containing current status
        """
        return {
            "status": self._status.value,
            "running": self._running,
            "default_version": self._default_version,
            "timestamp": datetime.now().isoformat()
        }
    
    def send_command(self, command: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a command to the engine.
        
        Args:
            command: The command name to execute
            params: Command parameters
            
        Returns:
            Dict containing command result
        """
        try:
            if self._status != EngineStatus.RUNNING:
                return {
                    "success": False,
                    "error": "Engine is not running",
                    "status": self._status.value
                }
            
            if command not in self._handlers:
                return {
                    "success": False,
                    "error": f"Unknown command: {command}"
                }
            
            # Execute the handler
            handler = self._handlers[command]
            result = handler(params)
            
            # Emit event for command execution
            self._emit_event("onCommandExecuted", {
                "command": command,
                "success": result.get("success", False),
                "timestamp": datetime.now().isoformat()
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Command execution failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "command": command
            }
    
    def register_event_callback(self, event_type: str, callback: Callable):
        """Register a callback for specific events."""
        if event_type not in self._event_callbacks:
            self._event_callbacks[event_type] = []
        self._event_callbacks[event_type].append(callback)
        logger.debug(f"Registered callback for event: {event_type}")
    
    def unregister_event_callback(self, event_type: str, callback: Callable):
        """Unregister a callback from specific events."""
        if event_type in self._event_callbacks:
            if callback in self._event_callbacks[event_type]:
                self._event_callbacks[event_type].remove(callback)
                logger.debug(f"Unregistered callback for event: {event_type}")
    
    def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """Emit an event to all registered callbacks."""
        if event_type in self._event_callbacks:
            for callback in self._event_callbacks[event_type]:
                try:
                    callback(event_type, data)
                except Exception as e:
                    logger.error(f"Event callback error: {str(e)}")
    
    def track_download(self, download_id: str, tracker: DownloadTracker):
        """Track an active download for progress reporting."""
        self._active_downloads[download_id] = tracker
    
    def get_download_tracker(self, download_id: str) -> Optional[DownloadTracker]:
        """Get an active download tracker by ID."""
        return self._active_downloads.get(download_id)
    
    def remove_download_tracker(self, download_id: str):
        """Remove a download tracker when complete."""
        if download_id in self._active_downloads:
            del self._active_downloads[download_id]
    
    def get_cache(self, key: str) -> Optional[Any]:
        """Get cached data by key."""
        return self._data_cache.get(key)
    
    def set_cache(self, key: str, value: Any):
        """Set cached data by key."""
        self._data_cache[key] = value
    
    def clear_cache(self):
        """Clear all cached data."""
        self._data_cache.clear()
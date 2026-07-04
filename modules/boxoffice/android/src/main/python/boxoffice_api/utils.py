"""
Utilities - Helper functions and classes for the BoxOffice API.
"""

import json
import re
from typing import Dict, Any, Optional
from datetime import datetime, timedelta


class ResponseFormatter:
    """
    Utility class for formatting API responses.
    Provides consistent response formatting and error handling.
    """
    
    @staticmethod
    def format_success(data: Any, message: str = "Success") -> Dict[str, Any]:
        """Format a success response."""
        return {
            "success": True,
            "data": data,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def format_error(error: str, code: Optional[int] = None) -> Dict[str, Any]:
        """Format an error response."""
        response = {
            "success": False,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        if code:
            response["code"] = code
        return response
    
    @staticmethod
    def format_paginated(data: list, page: int, limit: int, total: int) -> Dict[str, Any]:
        """Format a paginated response."""
        return {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit
            },
            "timestamp": datetime.now().isoformat()
        }


class DataValidator:
    """
    Utility class for data validation.
    """
    
    @staticmethod
    def validate_subject_id(subject_id: Any) -> bool:
        """Validate a subject ID."""
        try:
            return isinstance(subject_id, (int, str)) and len(str(subject_id)) > 0
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def validate_search_query(query: str) -> bool:
        """Validate a search query."""
        if not query:
            return False
        return len(query.strip()) >= 1
    
    @staticmethod
    def validate_page_params(page: Any, per_page: Any) -> tuple:
        """Validate and sanitize pagination parameters."""
        try:
            page = max(1, int(page) if page else 1)
            per_page = max(1, min(100, int(per_page) if per_page else 24))
            return page, per_page
        except (ValueError, TypeError):
            return 1, 24
    
    @staticmethod
    def validate_quality(quality: str) -> str:
        """Validate and normalize quality parameter."""
        valid_qualities = ["best", "worst", "360p", "480p", "720p", "1080p"]
        quality = quality.lower() if quality else "best"
        return quality if quality in valid_qualities else "best"
    
    @staticmethod
    def validate_subject_type(subject_type: str) -> str:
        """Validate and normalize subject type."""
        valid_types = ["ALL", "MOVIES", "TV_SERIES", "EDUCATION", "MUSIC", "ANIME", "OTHER"]
        subject_type = subject_type.upper() if subject_type else "ALL"
        return subject_type if subject_type in valid_types else "ALL"


class CacheManager:
    """
    Utility class for managing data cache.
    """
    
    def __init__(self):
        """Initialize the cache manager."""
        self._cache: Dict[str, Any] = {}
        self._expiry: Dict[str, datetime] = {}
        self._default_ttl = 300  # 5 minutes
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached data by key if not expired."""
        if key in self._cache:
            if key in self._expiry:
                if datetime.now() < self._expiry[key]:
                    return self._cache[key]
                else:
                    # Cache expired
                    del self._cache[key]
                    del self._expiry[key]
                    return None
            return self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set cached data with optional TTL."""
        self._cache[key] = value
        if ttl is not None:
            self._expiry[key] = datetime.now() + timedelta(seconds=ttl)
        elif key not in self._expiry:
            self._expiry[key] = datetime.now() + timedelta(seconds=self._default_ttl)
    
    def delete(self, key: str):
        """Delete cached data by key."""
        if key in self._cache:
            del self._cache[key]
        if key in self._expiry:
            del self._expiry[key]
    
    def clear(self):
        """Clear all cached data."""
        self._cache.clear()
        self._expiry.clear()
    
    def exists(self, key: str) -> bool:
        """Check if cache key exists and is not expired."""
        if key in self._cache:
            if key in self._expiry:
                return datetime.now() < self._expiry[key]
            return True
        return False


class Logger:
    """
    Simple logger utility for the BoxOffice API.
    """
    
    _instance: Optional['Logger'] = None
    
    def __new__(cls):
        """Singleton pattern for logger."""
        if cls._instance is None:
            cls._instance = super(Logger, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize logger instance."""
        if hasattr(self, '_initialized') and self._initialized:
            return
        self._initialized = True
        self._log_level = "INFO"
    
    def _log(self, level: str, message: str, **kwargs):
        """Internal log method."""
        timestamp = datetime.now().isoformat()
        extra = f" {kwargs}" if kwargs else ""
        print(f"[{timestamp}] [{level}] {message}{extra}")
    
    def debug(self, message: str, **kwargs):
        """Log debug message."""
        if self._log_level in ["DEBUG", "INFO", "WARNING", "ERROR"]:
            self._log("DEBUG", message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message."""
        self._log("INFO", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self._log("WARNING", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error message."""
        self._log("ERROR", message, **kwargs)
    
    def set_level(self, level: str):
        """Set logging level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR"]
        if level in valid_levels:
            self._log_level = level


class StringUtils:
    """
    Utility class for string operations.
    """
    
    @staticmethod
    def snake_to_camel(s: str) -> str:
        """Convert snake_case to camelCase."""
        parts = s.split('_')
        return parts[0] + ''.join(p.capitalize() for p in parts[1:])
    
    @staticmethod
    def camel_to_snake(s: str) -> str:
        """Convert camelCase to snake_case."""
        return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s).lower()
    
    @staticmethod
    def truncate(text: str, length: int = 200, suffix: str = "...") -> str:
        """Truncate text to specified length."""
        if len(text) <= length:
            return text
        return text[:length - len(suffix)] + suffix
    
    @staticmethod
    def clean_html(text: str) -> str:
        """Remove HTML tags from text."""
        return re.sub(r'<[^>]+>', '', text) if text else ""
    
    @staticmethod
    def slugify(text: str) -> str:
        """Convert text to URL-friendly slug."""
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s-]', '', text)
        text = re.sub(r'[\s-]+', '-', text)
        return text.strip('-')
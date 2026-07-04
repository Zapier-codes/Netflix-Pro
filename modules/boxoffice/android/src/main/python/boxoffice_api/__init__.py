"""
BoxOffice API - Python backend for the BoxOffice React Native module.
This package provides the core engine functionality for moviebox.ph search,
discovery, and download operations using the real moviebox-api SDK.
"""

from .main import BoxOfficeEngine
from .handlers import RequestHandler
from .utils import ResponseFormatter, Logger, DataValidator, StringUtils, CacheManager
from .callback_wrapper import KotlinCallbackWrapper, make_callback

__version__ = "1.0.0"
__all__ = [
    "BoxOfficeEngine",
    "RequestHandler",
    "ResponseFormatter",
    "Logger",
    "DataValidator",
    "StringUtils",
    "CacheManager",
    "KotlinCallbackWrapper",
    "make_callback"
]
package expo.modules.boxoffice

/**
 * Custom exceptions for the BoxOffice module.
 * Maps to real moviebox-api SDK error conditions.
 */

sealed class BoxOfficeException(message: String, cause: Throwable? = null) : Exception(message, cause) {

    /**
     * Engine is not running or not initialized.
     */
    class EngineNotRunningException(
        message: String = "BoxOffice engine is not running. Call start() first."
    ) : BoxOfficeException(message)

    /**
     * Engine failed to initialize (Python/Chaquopy error).
     */
    class EngineInitializationException(
        message: String = "Failed to initialize BoxOffice engine.",
        cause: Throwable? = null
    ) : BoxOfficeException(message, cause)

    /**
     * Python SDK import failed (moviebox-api not installed).
     */
    class SDKNotFoundException(
        message: String = "moviebox-api Python package not found. Check requirements.txt."
    ) : BoxOfficeException(message)

    /**
     * Network error during moviebox.ph request.
     */
    class NetworkException(
        message: String = "Network error connecting to moviebox.ph.",
        cause: Throwable? = null
    ) : BoxOfficeException(message, cause)

    /**
     * Search query returned no results.
     */
    class NoResultsException(
        message: String = "No results found for the given query."
    ) : BoxOfficeException(message)

    /**
     * Invalid subject ID or detailPath provided.
     */
    class InvalidSubjectException(
        message: String = "Invalid subject ID or detail path."
    ) : BoxOfficeException(message)

    /**
     * Download failed (file not available, storage full, etc).
     */
    class DownloadFailedException(
        message: String = "Download failed.",
        cause: Throwable? = null
    ) : BoxOfficeException(message, cause)

    /**
     * Download was cancelled by user.
     */
    class DownloadCancelledException(
        message: String = "Download was cancelled."
    ) : BoxOfficeException(message)

    /**
     * Quality/resolution not available for the requested item.
     */
    class QualityNotAvailableException(
        message: String = "Requested quality is not available for this item."
    ) : BoxOfficeException(message)

    /**
     * Subtitle language not available.
     */
    class CaptionNotAvailableException(
        message: String = "Requested subtitle language is not available."
    ) : BoxOfficeException(message)

    /**
     * Rate limited by moviebox.ph.
     */
    class RateLimitException(
        message: String = "Rate limited by moviebox.ph. Please wait before retrying."
    ) : BoxOfficeException(message)

    /**
     * Item has no downloadable resources.
     */
    class NoResourceException(
        message: String = "This item has no downloadable resources."
    ) : BoxOfficeException(message)

    /**
     * Unknown command sent to engine.
     */
    class UnknownCommandException(
        command: String
    ) : BoxOfficeException("Unknown command: $command")

    /**
     * Generic command execution failure.
     */
    class CommandExecutionException(
        message: String,
        cause: Throwable? = null
    ) : BoxOfficeException(message, cause)

    companion object {
        /**
         * Map a Python engine error string to the appropriate exception type.
         */
        fun fromPythonError(error: String, command: String? = null): BoxOfficeException {
            return when {
                error.contains("ModuleNotFoundError") || error.contains("No module named") ->
                    SDKNotFoundException(error)
                error.contains("not initialized") || error.contains("not running") ->
                    EngineNotRunningException(error)
                error.contains("not found") || error.contains("No results") ->
                    NoResultsException(error)
                error.contains("Invalid") || error.contains("required") ->
                    InvalidSubjectException(error)
                error.contains("Download") && error.contains("cancelled") ->
                    DownloadCancelledException(error)
                error.contains("Download") ->
                    DownloadFailedException(error)
                error.contains("quality") || error.contains("resolution") ->
                    QualityNotAvailableException(error)
                error.contains("subtitle") || error.contains("caption") ->
                    CaptionNotAvailableException(error)
                error.contains("rate limit") || error.contains("too many requests") ->
                    RateLimitException(error)
                error.contains("no resource") || error.contains("hasResource") ->
                    NoResourceException(error)
                error.contains("Unknown command") ->
                    UnknownCommandException(command ?: "unknown")
                else ->
                    CommandExecutionException(error)
            }
        }
    }
}
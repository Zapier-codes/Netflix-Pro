package expo.modules.boxoffice.types

/**
 * Type-safe representation of the BoxOffice engine status.
 * Maps to the Python engine's get_status() response.
 */

data class EngineStatus(
    val status: String,
    val running: Boolean,
    val defaultVersion: String = "v2",
    val timestamp: String
) {
    companion object {
        const val STATUS_IDLE = "idle"
        const val STATUS_INITIALIZING = "initializing"
        const val STATUS_RUNNING = "running"
        const val STATUS_STOPPED = "stopped"
        const val STATUS_ERROR = "error"
    }

    /**
     * Check if engine is currently running.
     */
    fun isRunning(): Boolean = running && status == STATUS_RUNNING

    /**
     * Check if engine is idle (not started).
     */
    fun isIdle(): Boolean = status == STATUS_IDLE

    /**
     * Check if engine is initializing.
     */
    fun isInitializing(): Boolean = status == STATUS_INITIALIZING

    /**
     * Check if engine is stopped.
     */
    fun isStopped(): Boolean = status == STATUS_STOPPED

    /**
     * Check if engine is in error state.
     */
    fun isError(): Boolean = status == STATUS_ERROR

    /**
     * Convert to a plain Map for JS bridge.
     */
    fun toMap(): Map<String, Any> {
        return mapOf(
            "status" to status,
            "running" to running,
            "defaultVersion" to defaultVersion,
            "timestamp" to timestamp
        )
    }

    /**
     * Create from a Map returned by Python.
     */
    fun fromMap(map: Map<String, Any?>): EngineStatus {
        return EngineStatus(
            status = map["status"] as? String ?: STATUS_IDLE,
            running = map["running"] as? Boolean ?: false,
            defaultVersion = map["default_version"] as? String ?: "v2",
            timestamp = map["timestamp"] as? String ?: System.currentTimeMillis().toString()
        )
    }
}
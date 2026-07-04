package expo.modules.boxoffice.types

/**
 * Type-safe representation of a command result from the Python engine.
 * Maps to the real moviebox-api SDK response format.
 */

data class CommandResult(
    val success: Boolean,
    val data: Any? = null,
    val error: String? = null,
    val message: String? = null,
    val timestamp: String? = null,
    val command: String? = null
) {
    companion object {
        /**
         * Create a success result.
         */
        fun success(
            data: Any? = null,
            message: String? = null,
            timestamp: String? = null
        ): CommandResult = CommandResult(
            success = true,
            data = data,
            message = message,
            timestamp = timestamp ?: System.currentTimeMillis().toString()
        )

        /**
         * Create an error result.
         */
        fun error(
            error: String,
            command: String? = null,
            timestamp: String? = null
        ): CommandResult = CommandResult(
            success = false,
            error = error,
            command = command,
            timestamp = timestamp ?: System.currentTimeMillis().toString()
        )
    }

    /**
     * Check if this result represents a successful operation.
     */
    fun isSuccess(): Boolean = success

    /**
     * Check if this result represents a failed operation.
     */
    fun isError(): Boolean = !success

    /**
     * Get the result data or throw if error.
     */
    @Throws(IllegalStateException::class)
    fun requireData(): Any {
        if (!success) {
            throw IllegalStateException("Cannot get data from failed result: $error")
        }
        return data ?: throw IllegalStateException("Success result has no data")
    }

    /**
     * Convert to a plain Map for JS bridge.
     */
    fun toMap(): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>(
            "success" to success
        )
        data?.let { map["data"] = it }
        error?.let { map["error"] = it }
        message?.let { map["message"] = it }
        timestamp?.let { map["timestamp"] = it }
        command?.let { map["command"] = it }
        return map
    }
}
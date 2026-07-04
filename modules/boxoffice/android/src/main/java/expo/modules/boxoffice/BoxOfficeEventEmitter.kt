package expo.modules.boxoffice

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class BoxOfficeEventEmitter(private val reactContext: ReactApplicationContext) {

    companion object {
        const val EVENT_STATUS_CHANGE = "onBoxOfficeStatusChange"
        const val EVENT_COMMAND_EXECUTED = "onBoxOfficeCommandExecuted"
        const val EVENT_DOWNLOAD_PROGRESS = "onBoxOfficeDownloadProgress"
        const val EVENT_ERROR = "onBoxOfficeError"
    }

    /**
     * Emit a status change event to JavaScript.
     */
    fun emitStatusChange(status: String, timestamp: String) {
        val params = Arguments.createMap().apply {
            putString("status", status)
            putString("timestamp", timestamp)
        }
        emit(EVENT_STATUS_CHANGE, params)
    }

    /**
     * Emit a command executed event to JavaScript.
     */
    fun emitCommandExecuted(command: String, success: Boolean, timestamp: String) {
        val params = Arguments.createMap().apply {
            putString("command", command)
            putBoolean("success", success)
            putString("timestamp", timestamp)
        }
        emit(EVENT_COMMAND_EXECUTED, params)
    }

    /**
     * Emit a download progress event to JavaScript.
     */
    fun emitDownloadProgress(
        downloadId: String,
        downloadedSize: Long,
        expectedSize: Long,
        percent: Double,
        isComplete: Boolean,
        savedTo: String?
    ) {
        val params = Arguments.createMap().apply {
            putString("downloadId", downloadId)
            putDouble("downloadedSize", downloadedSize.toDouble())
            putDouble("expectedSize", expectedSize.toDouble())
            putDouble("percent", percent)
            putBoolean("isComplete", isComplete)
            savedTo?.let { putString("savedTo", it) }
        }
        emit(EVENT_DOWNLOAD_PROGRESS, params)
    }

    /**
     * Emit an error event to JavaScript.
     */
    fun emitError(errorCode: String, errorMessage: String, command: String? = null) {
        val params = Arguments.createMap().apply {
            putString("errorCode", errorCode)
            putString("errorMessage", errorMessage)
            command?.let { putString("command", it) }
        }
        emit(EVENT_ERROR, params)
    }

    /**
     * Generic emit helper.
     */
    private fun emit(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    }

    /**
     * Check if there are listeners for a specific event.
     */
    fun hasListeners(eventName: String): Boolean {
        // React Native doesn't expose listener count directly
        // This is a placeholder - in practice, events are always emitted
        return true
    }
}
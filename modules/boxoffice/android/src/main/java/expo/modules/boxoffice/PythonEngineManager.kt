package expo.modules.boxoffice

import com.chaquo.python.PyObject
import com.chaquo.python.Python

class PythonEngineManager(
    private val packageName: String,
    private val engineClassName: String
) {
    private val python: Python = Python.getInstance()
    private val engineModule: PyObject
    private val engineClass: PyObject
    private var engineInstance: PyObject? = null

    init {
        engineModule = python.getModule(packageName)
        engineClass = engineModule.get(engineClassName)
    }

    fun configure(config: Map<String, Any>): Map<String, Any> {
        ensureEngineInstance()
        val result = engineInstance!!.callAttr("configure", mapToPyDict(config))
        return pyObjectToMap(result)
    }

    fun start(): Map<String, Any> {
        ensureEngineInstance()
        val result = engineInstance!!.callAttr("start")
        return pyObjectToMap(result)
    }

    fun stop(): Map<String, Any> {
        ensureEngineInstance()
        val result = engineInstance!!.callAttr("stop")
        return pyObjectToMap(result)
    }

    fun getStatus(): Map<String, Any> {
        ensureEngineInstance()
        val result = engineInstance!!.callAttr("get_status")
        return pyObjectToMap(result)
    }

    fun sendCommand(command: String, params: Map<String, Any>): Map<String, Any> {
        ensureEngineInstance()
        val result = engineInstance!!.callAttr("send_command", command, mapToPyDict(params))
        return pyObjectToMap(result)
    }

    /**
     * Register an event callback.
     * Uses a Python wrapper module that bridges to Kotlin via Chaquopy's
     * automatic Java class exposure.
     */
    fun registerEventCallback(eventType: String, onEvent: (String, Map<String, Any>) -> Unit) {
        ensureEngineInstance()

        // Create proxy and set it in Python wrapper
        val proxy = EventCallbackProxy(onEvent)
        val wrapperModule = python.getModule("$packageName.callback_wrapper")
        wrapperModule.callAttr("KotlinCallbackWrapper.set_proxy", proxy)

        // Get Python callback function
        val pyCallback = wrapperModule.callAttr("make_callback")

        engineInstance!!.callAttr("register_event_callback", eventType, pyCallback)
    }

    fun unregisterEventCallback(eventType: String) {
        ensureEngineInstance()
        engineInstance!!.callAttr("unregister_event_callback", eventType)
    }

    fun cleanup() {
        try {
            engineInstance?.callAttr("stop")
            engineInstance = null
        } catch (e: Exception) {
            // Ignore
        }
    }

    // ==================== PRIVATE ====================

    private fun ensureEngineInstance() {
        if (engineInstance == null) {
            engineInstance = engineClass.call()
        }
    }

    private fun mapToPyDict(map: Map<String, Any>): PyObject {
        val pyDict = python.builtins.get("dict").call()
        for ((key, value) in map) {
            val pyValue = when (value) {
                is String -> python.builtins.get("str").call(value)
                is Int -> python.builtins.get("int").call(value)
                is Double -> python.builtins.get("float").call(value)
                is Boolean -> python.builtins.get("bool").call(value)
                is Map<*, *> -> mapToPyDict(value as Map<String, Any>)
                is List<*> -> listToPyList(value)
                else -> python.builtins.get("str").call(value.toString())
            }
            pyDict.callAttr("__setitem__", key, pyValue)
        }
        return pyDict
    }

    private fun listToPyList(list: List<*>): PyObject {
        val pyList = python.builtins.get("list").call()
        for (item in list) {
            val pyItem = when (item) {
                is String -> python.builtins.get("str").call(item)
                is Int -> python.builtins.get("int").call(item)
                is Double -> python.builtins.get("float").call(item)
                is Boolean -> python.builtins.get("bool").call(item)
                is Map<*, *> -> mapToPyDict(item as Map<String, Any>)
                is List<*> -> listToPyList(item)
                else -> python.builtins.get("str").call(item.toString())
            }
            pyList.callAttr("append", pyItem)
        }
        return pyList
    }

    private fun pyObjectToMap(pyObject: PyObject): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        if (pyObject.isDict) {
            val keys = pyObject.callAttr("keys").asList()
            for (key in keys) {
                val keyStr = key.toString()
                val value = pyObject.callAttr("__getitem__", key)
                result[keyStr] = pyObjectToValue(value)
            }
        }
        return result
    }

    private fun pyObjectToValue(pyObject: PyObject): Any {
        return when {
            pyObject.isNone -> ""
            pyObject.isBool -> pyObject.toBoolean()
            pyObject.isInt -> pyObject.toInt()
            pyObject.isFloat -> pyObject.toDouble()
            pyObject.isStr -> pyObject.toString()
            pyObject.isDict -> pyObjectToMap(pyObject)
            pyObject.isList -> pyObjectToList(pyObject)
            else -> pyObject.toString()
        }
    }

    private fun pyObjectToList(pyObject: PyObject): List<Any> {
        val result = mutableListOf<Any>()
        val items = pyObject.asList()
        for (item in items) {
            result.add(pyObjectToValue(item))
        }
        return result
    }

    // ==================== STATIC CONVERSION (for inner class) ====================

    companion object {
        @JvmStatic
        fun pyObjectToMapStatic(pyObject: PyObject): Map<String, Any> {
            val result = mutableMapOf<String, Any>()
            if (pyObject.isDict) {
                val keys = pyObject.callAttr("keys").asList()
                for (key in keys) {
                    val keyStr = key.toString()
                    val value = pyObject.callAttr("__getitem__", key)
                    result[keyStr] = pyObjectToValueStatic(value)
                }
            }
            return result
        }

        @JvmStatic
        private fun pyObjectToValueStatic(pyObject: PyObject): Any {
            return when {
                pyObject.isNone -> ""
                pyObject.isBool -> pyObject.toBoolean()
                pyObject.isInt -> pyObject.toInt()
                pyObject.isFloat -> pyObject.toDouble()
                pyObject.isStr -> pyObject.toString()
                pyObject.isDict -> pyObjectToMapStatic(pyObject)
                pyObject.isList -> pyObjectToListStatic(pyObject)
                else -> pyObject.toString()
            }
        }

        @JvmStatic
        private fun pyObjectToListStatic(pyObject: PyObject): List<Any> {
            val result = mutableListOf<Any>()
            val items = pyObject.asList()
            for (item in items) {
                result.add(pyObjectToValueStatic(item))
            }
            return result
        }
    }

    /**
     * Proxy class exposed to Python. Must be public and static for Chaquopy.
     */
    class EventCallbackProxy(private val callback: (String, Map<String, Any>) -> Unit) {
        fun onEvent(eventType: String, data: PyObject) {
            callback(eventType, pyObjectToMapStatic(data))
        }
    }
}
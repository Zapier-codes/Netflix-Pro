package expo.modules.boxoffice

import com.chaquo.python.PyObject
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import android.content.Context
import com.facebook.react.common.ApplicationHolder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

class PythonEngineManager(
    private val packageName: String,
    private val engineClassName: String
) {
    // Don't initialize Python here - use lazy delegation
    private val python: Python by lazy {
        if (!Python.isStarted()) {
            val context = ApplicationHolder.getApplication()
            Python.start(AndroidPlatform(context))
        }
        Python.getInstance()
    }
    
    private val engineModule: PyObject by lazy { python.getModule(packageName) }
    private val engineClass: PyObject by lazy { engineModule.get(engineClassName)!! }
    private var engineInstance: PyObject? = null

    // Tracks the pyCallback PyObjects handed to Python's register_event_callback,
    // keyed by eventType, so they can be handed back to unregister_event_callback.
    // Needed because register_event_callback(event_type, callback) on the Python
    // side (main.py) requires the *same* callback object to remove it from its
    // internal list - unregister_event_callback(event_type, callback) takes two
    // required arguments, not one.
    private val registeredCallbacks = ConcurrentHashMap<String, CopyOnWriteArrayList<PyObject>>()

    // No init block needed anymore - everything is lazy

    fun configure(config: Map<String, Any?>): Map<String, Any> {
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

    fun sendCommand(command: String, params: Map<String, Any?>): Map<String, Any> {
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

        registeredCallbacks.getOrPut(eventType) { CopyOnWriteArrayList() }.add(pyCallback)
    }

    fun unregisterEventCallback(eventType: String) {
        ensureEngineInstance()
        val callbacks = registeredCallbacks[eventType] ?: return
        for (callback in callbacks) {
            try {
                engineInstance!!.callAttr("unregister_event_callback", eventType, callback)
            } catch (e: Exception) {
                // Isolate per-callback failures so one bad unregister call
                // doesn't stop the rest from being cleaned up.
            }
        }
        registeredCallbacks.remove(eventType)
    }

    fun cleanup() {
        try {
            engineInstance?.callAttr("stop")
            engineInstance = null
            registeredCallbacks.clear()
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

    /**
     * Look up the Python type name of a PyObject (e.g. "dict", "list", "NoneType").
     * Chaquopy's PyObject has no isDict/isNone/isBool/etc. convenience properties,
     * so type checks go through the real attribute API instead.
     */
    private fun pyTypeName(pyObject: PyObject): String {
        return pyObject.get("__class__")!!.get("__name__")!!.toString()
    }

    private fun mapToPyDict(map: Map<String, Any?>): PyObject {
        val pyDict = python.builtins.get("dict")!!.call()
        for ((key, value) in map) {
            val pyValue = when {
                value == null -> python.builtins.get("None")!!
                value is String -> python.builtins.get("str")!!.call(value)
                value is Int -> python.builtins.get("int")!!.call(value)
                value is Double -> python.builtins.get("float")!!.call(value)
                value is Boolean -> python.builtins.get("bool")!!.call(value)
                value is Map<*, *> -> mapToPyDict(value as Map<String, Any?>)
                value is List<*> -> listToPyList(value)
                else -> python.builtins.get("str")!!.call(value.toString())
            }
            pyDict.callAttr("__setitem__", key, pyValue)
        }
        return pyDict
    }

    private fun listToPyList(list: List<*>): PyObject {
        val pyList = python.builtins.get("list")!!.call()
        for (item in list) {
            val pyItem = when {
                item == null -> python.builtins.get("None")!!
                item is String -> python.builtins.get("str")!!.call(item)
                item is Int -> python.builtins.get("int")!!.call(item)
                item is Double -> python.builtins.get("float")!!.call(item)
                item is Boolean -> python.builtins.get("bool")!!.call(item)
                item is Map<*, *> -> mapToPyDict(item as Map<String, Any?>)
                item is List<*> -> listToPyList(item)
                else -> python.builtins.get("str")!!.call(item.toString())
            }
            pyList.callAttr("append", pyItem)
        }
        return pyList
    }

    private fun pyObjectToMap(pyObject: PyObject): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        if (pyTypeName(pyObject) == "dict") {
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
        return when (pyTypeName(pyObject)) {
            "NoneType" -> ""
            "bool" -> pyObject.toBoolean()
            "int" -> pyObject.toInt()
            "float" -> pyObject.toDouble()
            "str" -> pyObject.toString()
            "dict" -> pyObjectToMap(pyObject)
            "list", "tuple" -> pyObjectToList(pyObject)
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
        private fun pyTypeNameStatic(pyObject: PyObject): String {
            return pyObject.get("__class__")!!.get("__name__")!!.toString()
        }

        @JvmStatic
        fun pyObjectToMapStatic(pyObject: PyObject): Map<String, Any> {
            val result = mutableMapOf<String, Any>()
            if (pyTypeNameStatic(pyObject) == "dict") {
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
            return when (pyTypeNameStatic(pyObject)) {
                "NoneType" -> ""
                "bool" -> pyObject.toBoolean()
                "int" -> pyObject.toInt()
                "float" -> pyObject.toDouble()
                "str" -> pyObject.toString()
                "dict" -> pyObjectToMapStatic(pyObject)
                "list", "tuple" -> pyObjectToListStatic(pyObject)
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
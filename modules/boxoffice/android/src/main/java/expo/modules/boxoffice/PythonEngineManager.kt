package expo.modules.boxoffice

import com.chaquo.python.PyObject
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.margelo.nitro.NitroModules
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

class PythonEngineManager(
    private val packageName: String,
    private val engineClassName: String
) {
    private val python: Python by lazy {
        if (!Python.isStarted()) {
            val context = NitroModules.applicationContext
                ?: error("NitroModules.applicationContext is null - cannot start Python interpreter")
            Python.start(AndroidPlatform(context))
        }
        Python.getInstance()
    }

    private val engineModule: PyObject by lazy { python.getModule(packageName) }
    private val engineClass: PyObject by lazy { engineModule.get(engineClassName)!! }
    private var engineInstance: PyObject? = null

    private val registeredCallbacks = ConcurrentHashMap<String, CopyOnWriteArrayList<PyObject>>()

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

    fun registerEventCallback(eventType: String, onEvent: (String, Map<String, Any>) -> Unit) {
        ensureEngineInstance()

        val proxy = EventCallbackProxy(onEvent)
        val wrapperModule = python.getModule("$packageName.callback_wrapper")
        wrapperModule.callAttr("KotlinCallbackWrapper.set_proxy", proxy)

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
     * Null-tolerant type name lookup. Chaquopy's asMap()/asList() views expose
     * Java platform types (PyObject!), so a Python None value can arrive here
     * as an actual Kotlin null even though the static type looks non-null.
     * 
     * CRITICAL FIX: Removed all !! operators. Each get() call is checked for null
     * before chaining to the next call. This prevents NPE when Chaquopy returns
     * null for __class__ or __name__ on corrupted/None objects.
     */
    private fun pyTypeName(pyObject: PyObject?): String {
        if (pyObject == null) return "NoneType"
        return try {
            val clazz = pyObject.get("__class__")
            if (clazz == null) return "NoneType"
            val name = clazz.get("__name__")
            if (name == null) return "NoneType"
            name.toString()
        } catch (e: Exception) {
            "NoneType"
        }
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

    /**
     * Convert a Python dict PyObject into a Kotlin Map.
     * Uses PyObject.asMap(), which gives a container-access (Python "[]")
     * view of the dict as Map<PyObject, PyObject> - this sidesteps the
     * dict_keys/dict_values view objects entirely, which do NOT support
     * __getitem__ and therefore blow up if passed through .asList().
     *
     * Values (and even keys, in principle) can come through as real Kotlin
     * null even though asMap()'s declared type is non-nullable - that's a
     * Java/Chaquopy platform-type artifact, not something Kotlin's type
     * system can catch. Every entry is converted defensively so one bad
     * field (e.g. a null poster/rating from the API) can't blow up the
     * entire response.
     * 
     * CRITICAL FIX: Wrapped the entire asMap() iteration in try-catch.
     * If asMap() itself throws (e.g., NPE from Chaquopy internals when
     * the dict contains unexpected null values), we return an empty map
     * rather than crashing. Also added explicit null checks on both key
     * and value before processing.
     */
    private fun pyObjectToMap(pyObject: PyObject?): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        if (pyObject == null) return result

        // Verify this is actually a dict before calling asMap()
        val typeName = try { pyTypeName(pyObject) } catch (e: Exception) { return result }
        if (typeName != "dict") return result

        return try {
            val mapView = pyObject.asMap()
            if (mapView == null) return result

            for (entry in mapView.entries) {
                val key = entry.key
                val value = entry.value

                // Skip null keys entirely
                if (key == null) continue

                val keyStr = try {
                    key.toString()
                } catch (e: Exception) {
                    continue
                }

                // value can be null (platform type) - pyObjectToValue handles it
                result[keyStr] = try {
                    pyObjectToValue(value)
                } catch (e: Exception) {
                    ""
                }
            }
            result
        } catch (e: Exception) {
            // asMap() or iteration threw - return what we have so far
            result
        }
    }

    /**
     * CRITICAL FIX: Added null safety for pyObjectToValue.
     * The pyObject parameter is a platform type (PyObject!) and can be
     * a real Kotlin null when Chaquopy's asMap() contains None values.
     * Also wrapped pyTypeName in try-catch since it can throw if the
     * object's __class__ attribute is inaccessible.
     */
    private fun pyObjectToValue(pyObject: PyObject?): Any {
        if (pyObject == null) return ""

        val typeName = try { pyTypeName(pyObject) } catch (e: Exception) { return "" }

        return when (typeName) {
            "NoneType" -> ""
            "bool" -> try { pyObject.toBoolean() } catch (e: Exception) { false }
            "int" -> try { pyObject.toInt() } catch (e: Exception) { 0 }
            "float" -> try { pyObject.toDouble() } catch (e: Exception) { 0.0 }
            "str" -> try { pyObject.toString() } catch (e: Exception) { "" }
            "dict" -> pyObjectToMap(pyObject)
            "list", "tuple" -> pyObjectToList(pyObject)
            else -> try { pyObject.toString() } catch (e: Exception) { "" }
        }
    }

    /**
     * CRITICAL FIX: Wrapped asList() call in try-catch and added null
     * safety for the list view and its elements. asList() can throw NPE
     * if the underlying Python object is not actually a list/tuple, or
     * if Chaquopy's internal representation is inconsistent.
     */
    private fun pyObjectToList(pyObject: PyObject?): List<Any> {
        val result = mutableListOf<Any>()
        if (pyObject == null) return result

        val typeName = try { pyTypeName(pyObject) } catch (e: Exception) { return result }
        if (typeName != "list" && typeName != "tuple") return result

        return try {
            val listView = pyObject.asList()
            if (listView == null) return result

            for (item in listView) {
                result.add(
                    try {
                        pyObjectToValue(item)
                    } catch (e: Exception) {
                        ""
                    }
                )
            }
            result
        } catch (e: Exception) {
            // asList() or iteration threw - return what we have so far
            result
        }
    }

    // ==================== STATIC CONVERSION (for inner class) ====================

    companion object {
        /**
         * CRITICAL FIX: Same null-safety fixes applied to static methods.
         * Removed all !! operators and wrapped get() calls in null checks.
         */
        private fun pyTypeNameStatic(pyObject: PyObject?): String {
            if (pyObject == null) return "NoneType"
            return try {
                val clazz = pyObject.get("__class__")
                if (clazz == null) return "NoneType"
                val name = clazz.get("__name__")
                if (name == null) return "NoneType"
                name.toString()
            } catch (e: Exception) {
                "NoneType"
            }
        }

        @JvmStatic
        fun pyObjectToMapStatic(pyObject: PyObject?): Map<String, Any> {
            val result = mutableMapOf<String, Any>()
            if (pyObject == null) return result

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Exception) { return result }
            if (typeName != "dict") return result

            return try {
                val mapView = pyObject.asMap()
                if (mapView == null) return result

                for (entry in mapView.entries) {
                    val key = entry.key
                    val value = entry.value

                    if (key == null) continue

                    val keyStr = try {
                        key.toString()
                    } catch (e: Exception) {
                        continue
                    }

                    result[keyStr] = try {
                        pyObjectToValueStatic(value)
                    } catch (e: Exception) {
                        ""
                    }
                }
                result
            } catch (e: Exception) {
                result
            }
        }

        @JvmStatic
        private fun pyObjectToValueStatic(pyObject: PyObject?): Any {
            if (pyObject == null) return ""

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Exception) { return "" }

            return when (typeName) {
                "NoneType" -> ""
                "bool" -> try { pyObject.toBoolean() } catch (e: Exception) { false }
                "int" -> try { pyObject.toInt() } catch (e: Exception) { 0 }
                "float" -> try { pyObject.toDouble() } catch (e: Exception) { 0.0 }
                "str" -> try { pyObject.toString() } catch (e: Exception) { "" }
                "dict" -> pyObjectToMapStatic(pyObject)
                "list", "tuple" -> pyObjectToListStatic(pyObject)
                else -> try { pyObject.toString() } catch (e: Exception) { "" }
            }
        }

        @JvmStatic
        private fun pyObjectToListStatic(pyObject: PyObject?): List<Any> {
            val result = mutableListOf<Any>()
            if (pyObject == null) return result

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Exception) { return result }
            if (typeName != "list" && typeName != "tuple") return result

            return try {
                val listView = pyObject.asList()
                if (listView == null) return result

                for (item in listView) {
                    result.add(
                        try {
                            pyObjectToValueStatic(item)
                        } catch (e: Exception) {
                            ""
                        }
                    )
                }
                result
            } catch (e: Exception) {
                result
            }
        }
    }

    class EventCallbackProxy(private val callback: (String, Map<String, Any>) -> Unit) {
        fun onEvent(eventType: String, data: PyObject) {
            callback(eventType, pyObjectToMapStatic(data))
        }
    }
}

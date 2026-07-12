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
                // Isolate per-callback failures
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
     * Null-tolerant type name lookup using Throwable to catch native crashes.
     */
    private fun pyTypeName(pyObject: PyObject?): String {
        if (pyObject == null) return "NoneType"
        return try {
            val clazz = pyObject.get("__class__")
            if (clazz == null) return "NoneType"
            val name = clazz.get("__name__")
            if (name == null) return "NoneType"
            name.toString()
        } catch (e: Throwable) {
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
     * CRITICAL FIX: Throwable catch + explicit iterator to handle corrupted native entries.
     */
    private fun pyObjectToMap(pyObject: PyObject?): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        if (pyObject == null) return result

        val typeName = try { pyTypeName(pyObject) } catch (e: Throwable) { return result }
        if (typeName != "dict") return result

        return try {
            val mapView = pyObject.asMap()
            if (mapView == null) return result

            // Explicit iterator — handles corrupted Set views from Chaquopy
            val iterator = mapView.entries.iterator()
            while (iterator.hasNext()) {
                val entry = try { iterator.next() } catch (e: Throwable) { continue }
                if (entry == null) continue

                val key = try { entry.key } catch (e: Throwable) { continue }
                val value = try { entry.value } catch (e: Throwable) { continue }
                if (key == null) continue

                val keyStr = try { key.toString() } catch (e: Throwable) { continue }

                result[keyStr] = try {
                    pyObjectToValue(value)
                } catch (e: Throwable) {
                    ""
                }
            }
            result
        } catch (e: Throwable) {
            result
        }
    }

    private fun pyObjectToValue(pyObject: PyObject?): Any {
        if (pyObject == null) return ""

        val typeName = try { pyTypeName(pyObject) } catch (e: Throwable) { return "" }

        return try {
            when (typeName) {
                "NoneType" -> ""
                "bool" -> pyObject.toBoolean()
                "int" -> pyObject.toInt()
                "float" -> pyObject.toDouble()
                "str" -> pyObject.toString()
                "dict" -> pyObjectToMap(pyObject)
                "list", "tuple" -> pyObjectToList(pyObject)
                else -> pyObject.toString()
            }
        } catch (e: Throwable) {
            ""
        }
    }

    private fun pyObjectToList(pyObject: PyObject?): List<Any> {
        val result = mutableListOf<Any>()
        if (pyObject == null) return result

        val typeName = try { pyTypeName(pyObject) } catch (e: Throwable) { return result }
        if (typeName != "list" && typeName != "tuple") return result

        return try {
            val listView = pyObject.asList()
            if (listView == null) return result

            val iterator = listView.iterator()
            while (iterator.hasNext()) {
                val item = try { iterator.next() } catch (e: Throwable) { continue }
                result.add(
                    try {
                        pyObjectToValue(item)
                    } catch (e: Throwable) {
                        ""
                    }
                )
            }
            result
        } catch (e: Throwable) {
            result
        }
    }

    // ==================== STATIC CONVERSION (for inner class) ====================

    companion object {
        private fun pyTypeNameStatic(pyObject: PyObject?): String {
            if (pyObject == null) return "NoneType"
            return try {
                val clazz = pyObject.get("__class__")
                if (clazz == null) return "NoneType"
                val name = clazz.get("__name__")
                if (name == null) return "NoneType"
                name.toString()
            } catch (e: Throwable) {
                "NoneType"
            }
        }

        @JvmStatic
        fun pyObjectToMapStatic(pyObject: PyObject?): Map<String, Any> {
            val result = mutableMapOf<String, Any>()
            if (pyObject == null) return result

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Throwable) { return result }
            if (typeName != "dict") return result

            return try {
                val mapView = pyObject.asMap()
                if (mapView == null) return result

                val iterator = mapView.entries.iterator()
                while (iterator.hasNext()) {
                    val entry = try { iterator.next() } catch (e: Throwable) { continue }
                    if (entry == null) continue

                    val key = try { entry.key } catch (e: Throwable) { continue }
                    val value = try { entry.value } catch (e: Throwable) { continue }
                    if (key == null) continue

                    val keyStr = try { key.toString() } catch (e: Throwable) { continue }

                    result[keyStr] = try {
                        pyObjectToValueStatic(value)
                    } catch (e: Throwable) {
                        ""
                    }
                }
                result
            } catch (e: Throwable) {
                result
            }
        }

        @JvmStatic
        private fun pyObjectToValueStatic(pyObject: PyObject?): Any {
            if (pyObject == null) return ""

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Throwable) { return "" }

            return try {
                when (typeName) {
                    "NoneType" -> ""
                    "bool" -> pyObject.toBoolean()
                    "int" -> pyObject.toInt()
                    "float" -> pyObject.toDouble()
                    "str" -> pyObject.toString()
                    "dict" -> pyObjectToMapStatic(pyObject)
                    "list", "tuple" -> pyObjectToListStatic(pyObject)
                    else -> pyObject.toString()
                }
            } catch (e: Throwable) {
                ""
            }
        }

        @JvmStatic
        private fun pyObjectToListStatic(pyObject: PyObject?): List<Any> {
            val result = mutableListOf<Any>()
            if (pyObject == null) return result

            val typeName = try { pyTypeNameStatic(pyObject) } catch (e: Throwable) { return result }
            if (typeName != "list" && typeName != "tuple") return result

            return try {
                val listView = pyObject.asList()
                if (listView == null) return result

                val iterator = listView.iterator()
                while (iterator.hasNext()) {
                    val item = try { iterator.next() } catch (e: Throwable) { continue }
                    result.add(
                        try {
                            pyObjectToValueStatic(item)
                        } catch (e: Throwable) {
                            ""
                        }
                    )
                }
                result
            } catch (e: Throwable) {
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
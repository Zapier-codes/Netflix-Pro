package expo.modules.mavin.pawns

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.pawns.sdk.common.dto.ServiceConfig
import com.pawns.sdk.common.dto.ServiceState
import com.pawns.sdk.common.dto.ServiceType
import com.pawns.sdk.common.sdk.Pawns
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class PawnsModule : Module() {

    companion object {
        private const val TAG = "PawnsModule"
        private const val PREFS_NAME = "pawns_prefs"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_CONSENT_GIVEN = "consent_given"
    }

    private var initialized = false
    private var lastError: String? = null
    private var stateJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun definition() = ModuleDefinition {

        Name("PawnsModule")

        Events("onSdkStarted", "onSdkStopped", "onConsentGranted", "onConsentDenied", "onError")

        // ─── INITIALIZE ──────────────────────────────────────────────────────────
        // Pawns SDK v1.8.1's Builder only takes an apiKey — it generates and
        // persists its own device UUID internally (see DeviceIdHelper in the
        // SDK). deviceID/deviceName were never used by anything and have been
        // removed from this signature and from storage.
        AsyncFunction("initialize") { apiKey: String, promise: Promise ->
            try {
                val ctx = appContext.reactContext!!

                // ─── STORE API KEY FOR BOOT RECEIVER ───────────────────────────
                val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_API_KEY, apiKey).apply()
                Log.d(TAG, "API key stored for boot receiver")

                // ─── RESTORE PRIOR CONSENT DECISION ─────────────────────────────
                // No auto-grant here: consent lives in prefs and is only ever set
                // by optIn()/optOut(). Default false so a fresh install (or one
                // that never completed the consent flow) starts with sharing off.
                val consentAlreadyGiven = prefs.getBoolean(KEY_CONSENT_GIVEN, false)

                // ─── RESOURCE IDs ───────────────────────────────────────────────
                val iconRes = ctx.resources.getIdentifier("ic_stat_mavin", "drawable", ctx.packageName)
                    .takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info

                val titleRes = ctx.resources.getIdentifier("pawns_service_title", "string", ctx.packageName)
                    .takeIf { it != 0 } ?: android.R.string.ok

                val bodyRes = ctx.resources.getIdentifier("pawns_service_body", "string", ctx.packageName)
                    .takeIf { it != 0 } ?: android.R.string.cancel

                // ─── BUILD SDK ───────────────────────────────────────────────────
                Pawns.Builder(ctx)
                    .apiKey(apiKey)
                    .serviceConfig(ServiceConfig(
                        title = titleRes,
                        body = bodyRes,
                        smallIcon = iconRes
                    ))
                    .serviceType(ServiceType.FOREGROUND)
                    .build()

                initialized = true
                subscribeStateChanges()

                // ─── APPLY RESTORED CONSENT ──────────────────────────────────────
                // Mirror the persisted decision into the SDK. Sharing only starts
                // if the user genuinely opted in on a previous run — this is a
                // restoration of that prior "yes", not a fresh grant, so no
                // onConsentGranted event is fired here.
                val pawns = Pawns.getInstance()
                pawns.setConsentGiven(consentAlreadyGiven)

                if (consentAlreadyGiven) {
                    pawns.startSharing(ctx)
                    Log.d(TAG, "Consent previously granted — sharing resumed")
                } else {
                    Log.d(TAG, "No prior consent on record — sharing left off")
                }

                promise.resolve(mapOf("success" to true))

            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "Initialization failed: ${e.message}", e)
                promise.reject("INIT_ERROR", e.message ?: "SDK not initialised", e)
            }
        }

        // ─── START ──────────────────────────────────────────────────────────────
        AsyncFunction("start") { promise: Promise ->
            try {
                val ctx = appContext.reactContext!!
                Pawns.getInstance().startSharing(ctx)
                Log.d(TAG, "Sharing started")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "Start failed: ${e.message}", e)
                promise.reject("START_ERROR", e.message ?: "error", e)
            }
        }

        // ─── STOP ───────────────────────────────────────────────────────────────
        AsyncFunction("stop") { promise: Promise ->
            try {
                val ctx = appContext.reactContext!!
                Pawns.getInstance().stopSharing(ctx)
                Log.d(TAG, "Sharing stopped")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "Stop failed: ${e.message}", e)
                promise.reject("STOP_ERROR", e.message ?: "error", e)
            }
        }

        // ─── OPT IN ─────────────────────────────────────────────────────────────
        AsyncFunction("optIn") { promise: Promise ->
            try {
                val ctx = appContext.reactContext!!
                Pawns.getInstance().setConsentGiven(true)
                persistConsent(ctx, true)
                sendEvent("onConsentGranted", mapOf("timestamp" to System.currentTimeMillis()))
                Log.d(TAG, "Consent granted and persisted")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "OptIn failed: ${e.message}", e)
                promise.reject("OPTIN_ERROR", e.message ?: "error", e)
            }
        }

        // ─── OPT OUT ────────────────────────────────────────────────────────────
        AsyncFunction("optOut") { promise: Promise ->
            try {
                val ctx = appContext.reactContext!!
                Pawns.getInstance().stopSharing(ctx)
                Pawns.getInstance().setConsentGiven(false)
                persistConsent(ctx, false)
                sendEvent("onConsentDenied", mapOf("timestamp" to System.currentTimeMillis()))
                Log.d(TAG, "Consent denied and persisted")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "OptOut failed: ${e.message}", e)
                promise.reject("OPTOUT_ERROR", e.message ?: "error", e)
            }
        }

        // ─── GET STATUS ─────────────────────────────────────────────────────────
        AsyncFunction("getStatus") { promise: Promise ->
            try {
                val pawns = Pawns.getInstance()
                val state = pawns.getServiceStateSnapshot()
                val consent = pawns.isConsentGiven()

                val isRunning = state is ServiceState.Launched.Running ||
                                state is ServiceState.Launched.LowBattery

                val stateName = when (state) {
                    is ServiceState.Off -> "STOPPED"
                    is ServiceState.On -> "STARTING"
                    is ServiceState.Launched.Running -> "RUNNING"
                    is ServiceState.Launched.LowBattery -> "LOW_BATTERY"
                    is ServiceState.Launched.Error -> "ERROR"
                    else -> "UNKNOWN"
                }

                promise.resolve(mapOf(
                    "isRunning" to isRunning,
                    "isConsentGiven" to consent,
                    "serviceState" to stateName,
                    "initialized" to initialized,
                    "lastError" to lastError
                ))
            } catch (e: Exception) {
                lastError = e.message
                Log.e(TAG, "GetStatus failed: ${e.message}", e)
                promise.reject("STATUS_ERROR", e.message ?: "error", e)
            }
        }

        // ─── GET LAST ERROR ────────────────────────────────────────────────────
        AsyncFunction("getLastError") { promise: Promise ->
            promise.resolve(lastError)
        }

        // ─── CONFIGURE ─────────────────────────────────────────────────────────
        // Note: This is a no-op as per the integration guide's pattern.
        // If configuration is needed, implement here.
        AsyncFunction("configure") { _: Map<String, Any>?, promise: Promise ->
            promise.resolve(mapOf("success" to true))
        }

        // ─── REQUEST BATTERY OPTIMISATION ─────────────────────────────────────
        AsyncFunction("requestBatteryOptimisation") { promise: Promise ->
            try {
                val ctx = appContext.reactContext!!
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val pm = ctx.getSystemService(android.os.PowerManager::class.java)
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(ctx.packageName)) {
                        ctx.startActivity(
                            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:${ctx.packageName}")
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                        )
                    }
                }
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e(TAG, "Battery optimisation request failed: ${e.message}", e)
                promise.reject("BATTERY_ERROR", e.message ?: "error", e)
            }
        }

        OnDestroy {
            stateJob?.cancel()
            scope.cancel()
            Log.d(TAG, "Module destroyed")
        }
    }

    // ─── PERSIST CONSENT DECISION ────────────────────────────────────────────
    // Single source of truth for "did the user actually say yes", shared with
    // PawnsBootReceiver so a reboot can never resurrect sharing the user
    // turned off (or never turned on).
    private fun persistConsent(ctx: Context, granted: Boolean) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_CONSENT_GIVEN, granted)
            .apply()
    }

    // ─── SUBSCRIBE TO STATE CHANGES ─────────────────────────────────────────
    private fun subscribeStateChanges() {
        stateJob?.cancel()
        stateJob = scope.launch {
            try {
                Pawns.getInstance().getServiceState().collectLatest { state ->
                    when (state) {
                        is ServiceState.Launched.Running -> {
                            sendEvent("onSdkStarted", mapOf("timestamp" to System.currentTimeMillis()))
                        }
                        is ServiceState.Launched.LowBattery -> {
                            sendEvent("onSdkStarted", mapOf("timestamp" to System.currentTimeMillis()))
                        }
                        is ServiceState.Launched.Error -> {
                            lastError = state.error.toString()
                            sendEvent("onError", mapOf(
                                "message" to lastError,
                                "timestamp" to System.currentTimeMillis()
                            ))
                        }
                        is ServiceState.Off -> {
                            sendEvent("onSdkStopped", mapOf("timestamp" to System.currentTimeMillis()))
                        }
                        else -> {}
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "State flow ended: ${e.message}")
            }
        }
    }
}
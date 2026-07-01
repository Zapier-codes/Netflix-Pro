package expo.modules.mavin.pawns

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import com.pawns.sdk.common.dto.ServiceConfig
import com.pawns.sdk.common.dto.ServiceType
import com.pawns.sdk.common.sdk.Pawns

class PawnsBootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PawnsBootReceiver"
        private const val PREFS_NAME = "pawns_prefs"
        private const val KEY_API_KEY = "api_key"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.d(TAG, "BOOT_COMPLETED received")

        try {
            val ctx = context.applicationContext

            // ─── RETRIEVE STORED API KEY ────────────────────────────────────────
            val prefs: SharedPreferences = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val apiKey = prefs.getString(KEY_API_KEY, null)

            // ─── VALIDATE: Don't start without a stored key ────────────────────
            // A stored key only exists once the app has been opened at least
            // once (PawnsModule.initialize() is what writes it). If it's
            // missing, this is either a fresh install that's never been
            // launched, or init never completed — skip in both cases.
            if (apiKey.isNullOrEmpty()) {
                Log.w(TAG, "No stored API key — skipping boot restart")
                return
            }

            Log.d(TAG, "Retrieved stored API key, restarting sharing")

            // ─── RESOURCE IDs ──────────────────────────────────────────────────
            val iconRes = ctx.resources.getIdentifier("ic_stat_mavin", "drawable", ctx.packageName)
                .takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info

            val titleRes = ctx.resources.getIdentifier("pawns_service_title", "string", ctx.packageName)
                .takeIf { it != 0 } ?: android.R.string.ok

            val bodyRes = ctx.resources.getIdentifier("pawns_service_body", "string", ctx.packageName)
                .takeIf { it != 0 } ?: android.R.string.cancel

            // ─── BUILD SDK ─────────────────────────────────────────────────────
            // Pawns SDK v1.8.1's Builder only takes an apiKey — it generates
            // and persists its own device UUID internally (DeviceIdHelper).
            Pawns.Builder(ctx)
                .apiKey(apiKey)
                .serviceConfig(ServiceConfig(
                    title = titleRes,
                    body = bodyRes,
                    smallIcon = iconRes
                ))
                .serviceType(ServiceType.FOREGROUND)
                .build()

            val pawns = Pawns.getInstance()

            // ─── AUTO-CONSENT ──────────────────────────────────────────────────
            // Consent is auto-granted app-wide (no consent screen); ensure it's
            // set here too in case this is the first Pawns.getInstance() call
            // since a fresh process start.
            pawns.setConsentGiven(true)

            // ─── START SHARING ─────────────────────────────────────────────────
            pawns.startSharing(ctx)
            Log.d(TAG, "✅ Pawns sharing restarted after boot")

        } catch (e: Exception) {
            Log.e(TAG, "❌ Boot restart failed: ${e.message}", e)
        }
    }
}
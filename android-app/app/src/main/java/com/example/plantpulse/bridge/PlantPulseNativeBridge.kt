package com.example.plantpulse.bridge

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import com.example.plantpulse.data.local.PlantPulseDbHelper
import com.example.plantpulse.data.model.MoistureReading
import com.example.plantpulse.sync.SyncManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * PlantPulse Secure Native Bridge for Android WebView.
 * Provides safe, validated bidirectional communication between JavaScript web UI
 * and Android's local SQLite database and WorkManager synchronization engine.
 */
class PlantPulseNativeBridge(
    private val context: Context,
    private val defaultCloudApiUrl: String
) {
    private val dbHelper = PlantPulseDbHelper.getInstance(context)
    private val prefs: SharedPreferences = context.getSharedPreferences("plantpulse_native_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_API_URL = "custom_cloud_api_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
    }

    /**
     * Identify that the WebView is running inside the official Android Native App.
     */
    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    /**
     * Return live Android network connectivity state.
     */
    @JavascriptInterface
    fun isOnline(): Boolean = SyncManager.isConnected(context)

    /**
     * Save a soil moisture reading directly to local SQLite storage.
     * Automatically enqueues for cloud synchronization when network is available.
     */
    @JavascriptInterface
    fun saveMoistureReading(
        plantId: Int,
        sensorId: String,
        moistureLevel: Float,
        status: String
    ): String {
        return try {
            val uuid = "mob_" + UUID.randomUUID().toString()
            val reading = MoistureReading(
                clientUuid = uuid,
                plantId = plantId,
                sensorId = sensorId.ifBlank { "sensor_$plantId" },
                moistureLevel = moistureLevel,
                status = status.ifBlank { "good" },
                timestamp = System.currentTimeMillis(),
                syncStatus = MoistureReading.SYNC_STATUS_PENDING
            )

            val inserted = dbHelper.insertOrUpdateReading(reading)
            val isOnline = isOnline()

            if (isOnline) {
                // Trigger immediate background sync
                SyncManager.triggerBackgroundSync(
                    context,
                    getCloudApiUrl(),
                    getAuthToken()
                )
            }

            JSONObject().apply {
                put("success", inserted)
                put("client_uuid", uuid)
                put("offline", !isOnline)
                put("sync_status", MoistureReading.SYNC_STATUS_PENDING)
                put("message", if (isOnline) "Reading saved and syncing to cloud" else "Reading saved locally. Will sync when connected.")
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("message", "Local save error: " + e.message)
            }.toString()
        }
    }

    /**
     * Retrieve offline & synced readings for a specific plant from SQLite.
     */
    @JavascriptInterface
    fun getPlantReadingsJson(plantId: Int): String {
        return try {
            val readings = dbHelper.getReadingsForPlant(plantId, limit = 50)
            val array = JSONArray()
            for (r in readings) {
                array.put(r.toJsonObject())
            }
            array.toString()
        } catch (e: Exception) {
            "[]"
        }
    }

    /**
     * Get count of pending readings awaiting cloud synchronization.
     */
    @JavascriptInterface
    fun getPendingCount(): Int {
        return dbHelper.countPendingReadings()
    }

    /**
     * Trigger synchronization immediately on demand.
     */
    @JavascriptInterface
    fun triggerSyncNow(): String {
        return try {
            val res = SyncManager.performSync(context, getCloudApiUrl(), getAuthToken())
            JSONObject().apply {
                put("success", res.success)
                put("synced_count", res.syncedCount)
                put("failed_count", res.failedCount)
                put("message", res.message)
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("message", e.message)
            }.toString()
        }
    }

    /**
     * Cache plant catalog/overview from online API into local SQLite.
     */
    @JavascriptInterface
    fun cachePlants(plantsJson: String): Boolean {
        return try {
            val array = JSONArray(plantsJson)
            dbHelper.cachePlants(array)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Retrieve locally cached plants JSON array for offline dashboard rendering.
     */
    @JavascriptInterface
    fun getCachedPlants(): String {
        return dbHelper.getCachedPlantsJson()
    }

    /**
     * Retrieve active cloud API base URL.
     */
    @JavascriptInterface
    fun getCloudApiUrl(): String {
        return prefs.getString(KEY_API_URL, defaultCloudApiUrl)?.trimEnd('/') ?: defaultCloudApiUrl
    }

    /**
     * Configure active cloud API base URL at runtime.
     */
    @JavascriptInterface
    fun setCloudApiUrl(url: String): Boolean {
        return prefs.edit().putString(KEY_API_URL, url.trimEnd('/')).commit()
    }

    /**
     * Retrieve stored auth bearer token.
     */
    @JavascriptInterface
    fun getAuthToken(): String {
        return prefs.getString(KEY_AUTH_TOKEN, "") ?: ""
    }

    /**
     * Store auth bearer token for background WorkManager requests.
     */
    @JavascriptInterface
    fun setAuthToken(token: String): Boolean {
        return prefs.edit().putString(KEY_AUTH_TOKEN, token.trim()).commit()
    }
}

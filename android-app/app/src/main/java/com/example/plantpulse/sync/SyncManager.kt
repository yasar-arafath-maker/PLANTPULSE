package com.example.plantpulse.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import com.example.plantpulse.data.local.PlantPulseDbHelper
import com.example.plantpulse.data.model.MoistureReading
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class SyncResult(
    val success: Boolean,
    val syncedCount: Int,
    val failedCount: Int,
    val message: String
)

/**
 * PlantPulse Cloud Synchronization Manager.
 * Handles network connectivity callbacks, batch uploading of pending readings,
 * and automatic retries upon reconnection.
 */
object SyncManager {
    private const val TAG = "PlantPulseSync"
    private var isNetworkMonitoringStarted = false

    /**
     * Check if active internet connection is available.
     */
    fun isConnected(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    /**
     * Start listening for network state changes to automatically sync when connected.
     */
    fun startNetworkMonitoring(
        context: Context,
        onNetworkAvailable: () -> Unit
    ) {
        if (isNetworkMonitoringStarted) return
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        cm.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available. Triggering automatic background sync.")
                onNetworkAvailable()
            }

            override fun onLost(network: Network) {
                Log.d(TAG, "Network connection lost. Switching to offline mode.")
            }
        })

        isNetworkMonitoringStarted = true
    }

    /**
     * Perform immediate sync in background coroutine.
     */
    fun triggerBackgroundSync(
        context: Context,
        apiBaseUrl: String,
        authToken: String? = null,
        onComplete: ((SyncResult) -> Unit)? = null
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            val result = performSync(context, apiBaseUrl, authToken)
            withContext(Dispatchers.Main) {
                onComplete?.invoke(result)
            }
        }
    }

    /**
     * Synchronize pending readings from local SQLite to the PHP Cloud API.
     */
    fun performSync(
        context: Context,
        apiBaseUrl: String,
        authToken: String? = null
    ): SyncResult {
        val dbHelper = PlantPulseDbHelper.getInstance(context)

        // 1. Verify Connectivity
        if (!isConnected(context)) {
            Log.d(TAG, "Sync aborted: No network connection.")
            return SyncResult(false, 0, 0, "No network connection. Readings stored locally.")
        }

        // 2. Fetch Pending Readings
        val pending = dbHelper.getPendingReadings(limit = 100)
        if (pending.isEmpty()) {
            return SyncResult(true, 0, 0, "All readings are already synchronized.")
        }

        Log.d(TAG, "Found ${pending.size} pending readings to sync.")

        // 3. Build Batch JSON Payload
        val payload = JSONObject()
        val readingsArray = JSONArray()

        for (r in pending) {
            val item = JSONObject().apply {
                put("client_uuid", r.clientUuid)
                put("plant_id", r.plantId)
                put("sensor_id", r.sensorId)
                put("moisture_level", r.moistureLevel.toDouble())
                put("status", r.status)
                put("timestamp", r.timestamp)
            }
            readingsArray.put(item)
        }
        payload.put("readings", readingsArray)

        // 4. Send HTTP POST to /api/sensor/sync.php
        val syncEndpoint = apiBaseUrl.trimEnd('/') + "/sensor/sync.php"
        var connection: HttpURLConnection? = null
        var syncedCount = 0
        var failedCount = 0

        try {
            val url = URL(syncEndpoint)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 25000
                doOutput = true
                doInput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                if (!authToken.isNullOrBlank()) {
                    setRequestProperty("Authorization", "Bearer $authToken")
                    setRequestProperty("X-Auth-Token", authToken)
                }
            }

            // Write Body
            OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                writer.write(payload.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            val responseStream = if (responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream ?: connection.inputStream
            }

            val responseText = BufferedReader(InputStreamReader(responseStream, "UTF-8")).use {
                it.readText()
            }

            Log.d(TAG, "Sync response code: $responseCode, response length: ${responseText.length}")

            val trimmedResp = responseText.trim()
            if (responseCode in 200..299 && trimmedResp.startsWith("{")) {
                val respJson = JSONObject(trimmedResp)
                val isSuccess = respJson.optBoolean("success", false)

                if (isSuccess && respJson.has("results")) {
                    val results = respJson.getJSONArray("results")
                    for (i in 0 until results.length()) {
                        val item = results.getJSONObject(i)
                        val uuid = item.optString("client_uuid", "")
                        val status = item.optString("status", "")
                        val serverId = item.optLong("server_id", 0L)

                        if ((status == "synced" || status == "already_synced") && serverId > 0) {
                            dbHelper.markReadingSynced(uuid, serverId)
                            syncedCount++
                        } else {
                            val msg = item.optString("message", "Sync rejected by server")
                            dbHelper.markReadingFailed(uuid, msg)
                            failedCount++
                        }
                    }
                } else {
                    // Mark batch as failed
                    val err = respJson.optString("message", "Unexpected server response")
                    for (r in pending) {
                        dbHelper.markReadingFailed(r.clientUuid, err)
                        failedCount++
                    }
                }
            } else {
                val errSummary = if (trimmedResp.startsWith("<")) {
                    "HTTP $responseCode: Server returned HTML challenge or error page"
                } else {
                    "HTTP $responseCode: ${trimmedResp.take(120)}"
                }
                for (r in pending) {
                    dbHelper.markReadingFailed(r.clientUuid, errSummary)
                    failedCount++
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Network error during sync: ${e.message}", e)
            val err = e.message ?: "Network error"
            for (r in pending) {
                dbHelper.markReadingFailed(r.clientUuid, err)
                failedCount++
            }
            return SyncResult(false, 0, pending.size, "Sync failed: $err")
        } finally {
            connection?.disconnect()
        }

        val success = (failedCount == 0 && syncedCount > 0)
        val msg = "Sync completed: $syncedCount synced, $failedCount failed."
        return SyncResult(success, syncedCount, failedCount, msg)
    }
}

package com.example.plantpulse.data.model

import org.json.JSONObject

/**
 * Data model for a soil moisture reading with offline-first synchronization state.
 */
data class MoistureReading(
    val clientUuid: String,
    val serverId: Long? = null,
    val plantId: Int,
    val sensorId: String,
    val moistureLevel: Float,
    val status: String, // 'critical', 'low', 'good', 'high'
    val timestamp: Long = System.currentTimeMillis(),
    val syncStatus: String = SYNC_STATUS_PENDING,
    val syncAttempts: Int = 0,
    val lastSyncError: String? = null
) {
    companion object {
        const val SYNC_STATUS_PENDING = "PENDING"
        const val SYNC_STATUS_SYNCING = "SYNCING"
        const val SYNC_STATUS_SYNCED = "SYNCED"
        const val SYNC_STATUS_FAILED = "FAILED"

        fun fromJsonObject(obj: JSONObject): MoistureReading {
            return MoistureReading(
                clientUuid = obj.getString("client_uuid"),
                serverId = if (obj.has("server_id") && !obj.isNull("server_id")) obj.getLong("server_id") else null,
                plantId = obj.getInt("plant_id"),
                sensorId = obj.optString("sensor_id", ""),
                moistureLevel = obj.getDouble("moisture_level").toFloat(),
                status = obj.optString("status", "good"),
                timestamp = obj.optLong("timestamp", System.currentTimeMillis()),
                syncStatus = obj.optString("sync_status", SYNC_STATUS_PENDING),
                syncAttempts = obj.optInt("sync_attempts", 0),
                lastSyncError = if (obj.has("last_sync_error") && !obj.isNull("last_sync_error")) obj.getString("last_sync_error") else null
            )
        }
    }

    fun toJsonObject(): JSONObject {
        return JSONObject().apply {
            put("client_uuid", clientUuid)
            put("server_id", serverId)
            put("plant_id", plantId)
            put("sensor_id", sensorId)
            put("moisture_level", moistureLevel.toDouble())
            put("status", status)
            put("timestamp", timestamp)
            put("sync_status", syncStatus)
            put("sync_attempts", syncAttempts)
            put("last_sync_error", lastSyncError)
        }
    }
}

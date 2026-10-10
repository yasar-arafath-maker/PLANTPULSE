package com.example.plantpulse.data.model

import org.json.JSONObject

/**
 * Data model for locally cached plant profile and latest reading.
 */
data class CachedPlant(
    val id: Int,
    val name: String,
    val type: String,
    val location: String,
    val idealMoistureMin: Int,
    val idealMoistureMax: Int,
    val sensorId: String,
    val apiKey: String,
    val emoji: String,
    val moistureLevel: Float?,
    val status: String?,
    val lastReadingTime: String?
) {
    fun toJsonObject(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("name", name)
            put("type", type)
            put("location", location)
            put("ideal_moisture_min", idealMoistureMin)
            put("ideal_moisture_max", idealMoistureMax)
            put("sensor_id", sensorId)
            put("api_key", apiKey)
            put("emoji", emoji)
            put("moisture_level", moistureLevel?.toDouble())
            put("status", status)
            put("last_reading_time", lastReadingTime)
        }
    }
}

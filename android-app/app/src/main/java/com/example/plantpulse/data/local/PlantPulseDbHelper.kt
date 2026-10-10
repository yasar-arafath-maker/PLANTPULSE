package com.example.plantpulse.data.local

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.example.plantpulse.data.model.CachedPlant
import com.example.plantpulse.data.model.MoistureReading
import org.json.JSONArray
import org.json.JSONObject

/**
 * PlantPulse Offline SQLite Database Helper.
 * Manages local persistent storage for moisture readings and cached plant profiles.
 */
class PlantPulseDbHelper(context: Context) : SQLiteOpenHelper(
    context,
    DATABASE_NAME,
    null,
    DATABASE_VERSION
) {

    companion object {
        const val DATABASE_NAME = "plantpulse_offline.db"
        const val DATABASE_VERSION = 1

        // Table moisture_readings
        const val TABLE_READINGS = "moisture_readings"
        const val COL_CLIENT_UUID = "client_uuid"
        const val COL_SERVER_ID = "server_id"
        const val COL_PLANT_ID = "plant_id"
        const val COL_SENSOR_ID = "sensor_id"
        const val COL_MOISTURE_LEVEL = "moisture_level"
        const val COL_STATUS = "status"
        const val COL_TIMESTAMP = "timestamp"
        const val COL_SYNC_STATUS = "sync_status"
        const val COL_SYNC_ATTEMPTS = "sync_attempts"
        const val COL_LAST_SYNC_ERROR = "last_sync_error"

        // Table cached_plants
        const val TABLE_PLANTS = "cached_plants"
        const val COL_P_ID = "id"
        const val COL_P_NAME = "name"
        const val COL_P_TYPE = "type"
        const val COL_P_LOCATION = "location"
        const val COL_P_IDEAL_MIN = "ideal_moisture_min"
        const val COL_P_IDEAL_MAX = "ideal_moisture_max"
        const val COL_P_SENSOR_ID = "sensor_id"
        const val COL_P_API_KEY = "api_key"
        const val COL_P_EMOJI = "emoji"
        const val COL_P_MOISTURE = "moisture_level"
        const val COL_P_STATUS = "status"
        const val COL_P_LAST_READING_TIME = "last_reading_time"
        const val COL_P_UPDATED_AT = "updated_at"

        @Volatile
        private var INSTANCE: PlantPulseDbHelper? = null

        fun getInstance(context: Context): PlantPulseDbHelper {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PlantPulseDbHelper(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createReadingsTable = """
            CREATE TABLE $TABLE_READINGS (
                $COL_CLIENT_UUID TEXT PRIMARY KEY,
                $COL_SERVER_ID INTEGER,
                $COL_PLANT_ID INTEGER NOT NULL,
                $COL_SENSOR_ID TEXT NOT NULL,
                $COL_MOISTURE_LEVEL REAL NOT NULL,
                $COL_STATUS TEXT NOT NULL,
                $COL_TIMESTAMP INTEGER NOT NULL,
                $COL_SYNC_STATUS TEXT NOT NULL,
                $COL_SYNC_ATTEMPTS INTEGER DEFAULT 0,
                $COL_LAST_SYNC_ERROR TEXT
            )
        """.trimIndent()

        val createPlantsTable = """
            CREATE TABLE $TABLE_PLANTS (
                $COL_P_ID INTEGER PRIMARY KEY,
                $COL_P_NAME TEXT NOT NULL,
                $COL_P_TYPE TEXT NOT NULL,
                $COL_P_LOCATION TEXT,
                $COL_P_IDEAL_MIN INTEGER,
                $COL_P_IDEAL_MAX INTEGER,
                $COL_P_SENSOR_ID TEXT,
                $COL_P_API_KEY TEXT,
                $COL_P_EMOJI TEXT,
                $COL_P_MOISTURE REAL,
                $COL_P_STATUS TEXT,
                $COL_P_LAST_READING_TIME TEXT,
                $COL_P_UPDATED_AT INTEGER
            )
        """.trimIndent()

        val createIndexReadings = "CREATE INDEX idx_reading_plant ON $TABLE_READINGS ($COL_PLANT_ID, $COL_TIMESTAMP)"
        val createIndexSync = "CREATE INDEX idx_reading_sync ON $TABLE_READINGS ($COL_SYNC_STATUS)"

        db.execSQL(createReadingsTable)
        db.execSQL(createPlantsTable)
        db.execSQL(createIndexReadings)
        db.execSQL(createIndexSync)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_READINGS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_PLANTS")
        onCreate(db)
    }

    // ============================================================
    // Moisture Readings Operations
    // ============================================================

    /**
     * Insert or update a moisture reading locally.
     */
    fun insertOrUpdateReading(reading: MoistureReading): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_CLIENT_UUID, reading.clientUuid)
            put(COL_SERVER_ID, reading.serverId)
            put(COL_PLANT_ID, reading.plantId)
            put(COL_SENSOR_ID, reading.sensorId)
            put(COL_MOISTURE_LEVEL, reading.moistureLevel)
            put(COL_STATUS, reading.status)
            put(COL_TIMESTAMP, reading.timestamp)
            put(COL_SYNC_STATUS, reading.syncStatus)
            put(COL_SYNC_ATTEMPTS, reading.syncAttempts)
            put(COL_LAST_SYNC_ERROR, reading.lastSyncError)
        }
        val result = db.insertWithOnConflict(TABLE_READINGS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
        return result != -1L
    }

    /**
     * Retrieve all readings pending cloud sync.
     */
    fun getPendingReadings(limit: Int = 100): List<MoistureReading> {
        val list = mutableListOf<MoistureReading>()
        val db = readableDatabase
        val query = """
            SELECT * FROM $TABLE_READINGS 
            WHERE $COL_SYNC_STATUS = ? OR $COL_SYNC_STATUS = ?
            ORDER BY $COL_TIMESTAMP ASC LIMIT ?
        """.trimIndent()

        val cursor = db.rawQuery(
            query,
            arrayOf(MoistureReading.SYNC_STATUS_PENDING, MoistureReading.SYNC_STATUS_FAILED, limit.toString())
        )

        cursor.use { c ->
            while (c.moveToNext()) {
                list.add(cursorToReading(c))
            }
        }
        return list
    }

    /**
     * Mark reading as successfully synced with the server.
     */
    fun markReadingSynced(clientUuid: String, serverId: Long) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_STATUS, MoistureReading.SYNC_STATUS_SYNCED)
            put(COL_SERVER_ID, serverId)
            put(COL_LAST_SYNC_ERROR, null as String?)
        }
        db.update(TABLE_READINGS, values, "$COL_CLIENT_UUID = ?", arrayOf(clientUuid))
    }

    /**
     * Mark reading as failed with incremented attempt counter and error message.
     */
    fun markReadingFailed(clientUuid: String, errorMessage: String) {
        val db = writableDatabase
        db.execSQL(
            """
            UPDATE $TABLE_READINGS 
            SET $COL_SYNC_STATUS = ?, $COL_SYNC_ATTEMPTS = $COL_SYNC_ATTEMPTS + 1, $COL_LAST_SYNC_ERROR = ? 
            WHERE $COL_CLIENT_UUID = ?
            """.trimIndent(),
            arrayOf(MoistureReading.SYNC_STATUS_FAILED, errorMessage, clientUuid)
        )
    }

    /**
     * Get readings for a plant, newest first.
     */
    fun getReadingsForPlant(plantId: Int, limit: Int = 50): List<MoistureReading> {
        val list = mutableListOf<MoistureReading>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_READINGS,
            null,
            "$COL_PLANT_ID = ?",
            arrayOf(plantId.toString()),
            null,
            null,
            "$COL_TIMESTAMP DESC",
            limit.toString()
        )

        cursor.use { c ->
            while (c.moveToNext()) {
                list.add(cursorToReading(c))
            }
        }
        return list
    }

    /**
     * Count total pending unsynced readings.
     */
    fun countPendingReadings(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM $TABLE_READINGS WHERE $COL_SYNC_STATUS = ? OR $COL_SYNC_STATUS = ?",
            arrayOf(MoistureReading.SYNC_STATUS_PENDING, MoistureReading.SYNC_STATUS_FAILED)
        )
        return cursor.use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }
    }

    private fun cursorToReading(c: Cursor): MoistureReading {
        val serverIdIdx = c.getColumnIndexOrThrow(COL_SERVER_ID)
        val serverId = if (c.isNull(serverIdIdx)) null else c.getLong(serverIdIdx)
        val errorIdx = c.getColumnIndexOrThrow(COL_LAST_SYNC_ERROR)
        val lastError = if (c.isNull(errorIdx)) null else c.getString(errorIdx)

        return MoistureReading(
            clientUuid = c.getString(c.getColumnIndexOrThrow(COL_CLIENT_UUID)),
            serverId = serverId,
            plantId = c.getInt(c.getColumnIndexOrThrow(COL_PLANT_ID)),
            sensorId = c.getString(c.getColumnIndexOrThrow(COL_SENSOR_ID)),
            moistureLevel = c.getFloat(c.getColumnIndexOrThrow(COL_MOISTURE_LEVEL)),
            status = c.getString(c.getColumnIndexOrThrow(COL_STATUS)),
            timestamp = c.getLong(c.getColumnIndexOrThrow(COL_TIMESTAMP)),
            syncStatus = c.getString(c.getColumnIndexOrThrow(COL_SYNC_STATUS)),
            syncAttempts = c.getInt(c.getColumnIndexOrThrow(COL_SYNC_ATTEMPTS)),
            lastSyncError = lastError
        )
    }

    // ============================================================
    // Cached Plants Operations (For Offline Dashboard)
    // ============================================================

    /**
     * Cache an array of plants from the API response into local SQLite.
     */
    fun cachePlants(plantsArray: JSONArray) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete(TABLE_PLANTS, null, null)
            val now = System.currentTimeMillis()

            for (i in 0 until plantsArray.length()) {
                val p = plantsArray.getJSONObject(i)
                val values = ContentValues().apply {
                    put(COL_P_ID, p.getInt("id"))
                    put(COL_P_NAME, p.getString("name"))
                    put(COL_P_TYPE, p.optString("type", ""))
                    put(COL_P_LOCATION, p.optString("location", "Indoor"))
                    put(COL_P_IDEAL_MIN, p.optInt("ideal_moisture_min", 40))
                    put(COL_P_IDEAL_MAX, p.optInt("ideal_moisture_max", 70))
                    put(COL_P_SENSOR_ID, p.optString("sensor_id", ""))
                    put(COL_P_API_KEY, p.optString("api_key", ""))
                    put(COL_P_EMOJI, p.optString("emoji", "🌿"))
                    if (p.has("moisture_level") && !p.isNull("moisture_level")) {
                        put(COL_P_MOISTURE, p.getDouble("moisture_level").toFloat())
                    } else {
                        putNull(COL_P_MOISTURE)
                    }
                    put(COL_P_STATUS, p.optString("status", "good"))
                    put(COL_P_LAST_READING_TIME, p.optString("last_reading_time", ""))
                    put(COL_P_UPDATED_AT, now)
                }
                db.insertWithOnConflict(TABLE_PLANTS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /**
     * Retrieve all cached plants as a JSON array string matching API format.
     */
    fun getCachedPlantsJson(): String {
        val db = readableDatabase
        val cursor = db.query(TABLE_PLANTS, null, null, null, null, null, "$COL_P_ID ASC")
        val jsonArray = JSONArray()

        cursor.use { c ->
            while (c.moveToNext()) {
                val obj = JSONObject().apply {
                    put("id", c.getInt(c.getColumnIndexOrThrow(COL_P_ID)))
                    put("name", c.getString(c.getColumnIndexOrThrow(COL_P_NAME)))
                    put("type", c.getString(c.getColumnIndexOrThrow(COL_P_TYPE)))
                    put("location", c.getString(c.getColumnIndexOrThrow(COL_P_LOCATION)))
                    put("ideal_moisture_min", c.getInt(c.getColumnIndexOrThrow(COL_P_IDEAL_MIN)))
                    put("ideal_moisture_max", c.getInt(c.getColumnIndexOrThrow(COL_P_IDEAL_MAX)))
                    put("sensor_id", c.getString(c.getColumnIndexOrThrow(COL_P_SENSOR_ID)))
                    put("api_key", c.getString(c.getColumnIndexOrThrow(COL_P_API_KEY)))
                    put("emoji", c.getString(c.getColumnIndexOrThrow(COL_P_EMOJI)))

                    val moistureIdx = c.getColumnIndexOrThrow(COL_P_MOISTURE)
                    if (c.isNull(moistureIdx)) {
                        put("moisture_level", JSONObject.NULL)
                    } else {
                        put("moisture_level", c.getFloat(moistureIdx).toDouble())
                    }
                    put("status", c.getString(c.getColumnIndexOrThrow(COL_P_STATUS)))
                    put("last_reading_time", c.getString(c.getColumnIndexOrThrow(COL_P_LAST_READING_TIME)))
                }
                jsonArray.put(obj)
            }
        }
        return jsonArray.toString()
    }
}

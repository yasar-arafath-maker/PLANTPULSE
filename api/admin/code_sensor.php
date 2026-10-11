<?php
require_once '../config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body = getBody();
$orderId   = (int)($body['order_id'] ?? 0);
$sensorId  = trim($body['sensor_id'] ?? '');
$minLimit  = (int)($body['min_moisture'] ?? 40);
$maxLimit  = (int)($body['max_moisture'] ?? 75);
$adminNotes= trim($body['admin_notes'] ?? '');
$dispatch  = !empty($body['dispatch']);

if ($orderId <= 0) {
    respond(['success' => false, 'message' => 'Invalid order ID'], 400);
}

// Fetch order details
$stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
$stmt->execute([$orderId]);
$order = $stmt->fetch();

if (!$order) {
    respond(['success' => false, 'message' => 'Order not found'], 404);
}

// Generate Sensor ID if not provided
if (empty($sensorId)) {
    $cleanType = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $order['plant_type']));
    $sensorId  = 'SENS-' . $cleanType . '-' . rand(1000, 9999);
}

// Generate API key for the hardware sensor
$apiKey = generateApiKey(32);
$orderStatus = $dispatch ? 'shipped' : 'coding_sensor';

try {
    $pdo->beginTransaction();

    // 1. Update order with coding parameters
    $stmt = $pdo->prepare('
        UPDATE orders 
        SET assigned_sensor_id = ?, 
            sensor_api_key = ?, 
            min_moisture_threshold = ?, 
            max_moisture_threshold = ?, 
            admin_notes = ?, 
            order_status = ? 
        WHERE id = ?
    ');
    $stmt->execute([
        $sensorId,
        $apiKey,
        $minLimit,
        $maxLimit,
        $adminNotes,
        $orderStatus,
        $orderId
    ]);

    // 2. Automatically provision plant entry in `plants` table for the user
    // Pick emoji based on plant type
    $emoji = '🌿';
    $pTypeLower = strtolower($order['plant_type']);
    if (str_contains($pTypeLower, 'rose'))      $emoji = '🌹';
    elseif (str_contains($pTypeLower, 'jasmine')) $emoji = '🌸';
    elseif (str_contains($pTypeLower, 'succulent')) $emoji = '🌵';
    elseif (str_contains($pTypeLower, 'fern'))   $emoji = '🌿';

    // Check if plant already exists for this sensor_id or create new
    $stmtCheck = $pdo->prepare('SELECT id FROM plants WHERE sensor_id = ?');
    $stmtCheck->execute([$sensorId]);
    $existingPlant = $stmtCheck->fetch();

    if ($existingPlant) {
        $stmtPlant = $pdo->prepare('
            UPDATE plants 
            SET name = ?, type = ?, ideal_moisture_min = ?, ideal_moisture_max = ?, api_key = ?, emoji = ?
            WHERE id = ?
        ');
        $stmtPlant->execute([
            $order['plant_name'],
            $order['plant_type'],
            $minLimit,
            $maxLimit,
            $apiKey,
            $emoji,
            $existingPlant['id']
        ]);
        $plantId = $existingPlant['id'];
    } else {
        $stmtPlant = $pdo->prepare('
            INSERT INTO plants (user_id, name, type, location, ideal_moisture_min, ideal_moisture_max, sensor_id, api_key, emoji)
            VALUES (?, ?, ?, "Garden/Indoor", ?, ?, ?, ?, ?)
        ');
        $stmtPlant->execute([
            $order['user_id'],
            $order['plant_name'],
            $order['plant_type'],
            $minLimit,
            $maxLimit,
            $sensorId,
            $apiKey,
            $emoji
        ]);
        $plantId = $pdo->lastInsertId();
    }

    // 3. Create welcome alert intimation for user
    $alertMsg = "Your hardware sensor [{$sensorId}] for {$order['plant_name']} ({$order['plant_type']}) has been programmed & coded by Admin! Moisture limits set to {$minLimit}% - {$maxLimit}%.";
    $stmtAlert = $pdo->prepare('
        INSERT INTO alerts (plant_id, user_id, message, alert_type) 
        VALUES (?, ?, ?, "info")
    ');
    $stmtAlert->execute([$plantId, $order['user_id'], $alertMsg]);

    $pdo->commit();

    // Determine live Cloud URL for sensor ingestion
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
    $hostHeader = $_SERVER['HTTP_HOST'] ?? 'plantpulse-backend-qhlo.onrender.com';
    $serverUrl = "{$protocol}://{$hostHeader}/api/sensor/ingest.php";
    if (strpos($serverUrl, 'localhost') !== false && !empty(getenv('RENDER_EXTERNAL_URL'))) {
        $serverUrl = rtrim(getenv('RENDER_EXTERNAL_URL'), '/') . '/api/sensor/ingest.php';
    }

    // Generate Universal ESP8266 & ESP32 Dual-Target firmware C++ code
    $arduinoCode = <<<CPP
/* 
 * PlantPulse IoT Firmware C++ Code - Coded by Admin for Order #{$orderId}
 * Plant: {$order['plant_name']} ({$order['plant_type']})
 * Target Moisture Range: {$minLimit}% to {$maxLimit}%
 * Sensor ID: {$sensorId}
 * Cloud Ingestion URL: {$serverUrl}
 */

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
  const int SENSOR_PIN = A0;
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
  const int SENSOR_PIN = 34; // Analog ADC1 pin
#endif

const char* ssid         = "YOUR_WIFI_SSID";
const char* password     = "YOUR_WIFI_PASSWORD";
const char* serverUrl    = "{$serverUrl}";

const char* SENSOR_ID    = "{$sensorId}";
const char* API_KEY      = "{$apiKey}";
const int   MIN_MOISTURE = {$minLimit};
const int   MAX_MOISTURE = {$maxLimit};

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[PlantPulse] Connecting to Wi-Fi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[PlantPulse] Wi-Fi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  int rawAnalog = analogRead(SENSOR_PIN);
  #if defined(ESP32)
    float moisturePercent = map(rawAnalog, 3200, 1200, 0, 100);
  #else
    float moisturePercent = map(rawAnalog, 1024, 250, 0, 100);
  #endif
  moisturePercent = constrain(moisturePercent, 0, 100);

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Required for HTTPS Cloud connectivity without CA bundles

    HTTPClient http;
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");

    String json = "{\"sensor_id\":\"" + String(SENSOR_ID) + 
                  "\",\"api_key\":\"" + String(API_KEY) + 
                  "\",\"moisture_level\":" + String(moisturePercent) + "}";

    int httpCode = http.POST(json);
    if (httpCode > 0) {
      Serial.printf("[PlantPulse] Telemetry sent! HTTP %d: %s\n", httpCode, http.getString().c_str());
    } else {
      Serial.printf("[PlantPulse] HTTP error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("[PlantPulse] Wi-Fi dropped. Reconnecting...");
    WiFi.reconnect();
  }
  delay(15000); // 15-second telemetry sampling interval
}
CPP;

    respond([
        'success'       => true,
        'message'       => 'Sensor successfully coded, configured, and bound to user plant!',
        'sensor_id'     => $sensorId,
        'api_key'       => $apiKey,
        'arduino_code'  => $arduinoCode
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    respond(['success' => false, 'message' => 'Failed to code sensor: ' . $e->getMessage()], 500);
}

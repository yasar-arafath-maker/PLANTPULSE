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

    // Generate ESP8266/Arduino firmware C++ code snippet for admin
    $arduinoCode = <<<CPP
/* 
 * Hardware Firmware C++ Code - Coded by Admin for Order #{$orderId}
 * Plant: {$order['plant_name']} ({$order['plant_type']})
 * Target Moisture Range: {$minLimit}% to {$maxLimit}%
 * Sensor ID: {$sensorId}
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* server   = "http://localhost/plant%20monitor%20app/api/sensor/ingest.php";

const char* SENSOR_ID = "{$sensorId}";
const char* API_KEY   = "{$apiKey}";
const int   MIN_MOISTURE = {$minLimit};
const int   MAX_MOISTURE = {$maxLimit};

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  Serial.println("Sensor Connected to PlantPulse Network!");
}

void loop() {
  int rawAnalog = analogRead(A0);
  float moisturePercent = map(rawAnalog, 1024, 200, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;
    http.begin(client, server);
    http.addHeader("Content-Type", "application/json");

    String json = "{\"sensor_id\":\"" + String(SENSOR_ID) + "\",\"api_key\":\"" + String(API_KEY) + "\",\"moisture_level\":" + String(moisturePercent) + "}";
    int httpCode = http.POST(json);
    http.end();
  }
  delay(15000); // Send reading every 15 seconds
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

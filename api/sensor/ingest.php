<?php
require_once '../config.php';

// Public endpoint — no session required
// Called by hardware sensor (NodeMCU / ESP8266 / Arduino etc.)

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body          = getBody();
$sensorId      = trim($body['sensor_id']      ?? '');
$moistureLevel = floatval($body['moisture_level'] ?? -1);
$apiKey        = trim($body['api_key']         ?? '');

// Validate inputs
if (empty($sensorId) || empty($apiKey)) {
    respond(['success' => false, 'message' => 'sensor_id and api_key are required'], 400);
}

if ($moistureLevel < 0 || $moistureLevel > 100) {
    respond(['success' => false, 'message' => 'moisture_level must be between 0 and 100'], 400);
}

// Find plant by sensor_id and api_key
$stmt = $pdo->prepare(
    'SELECT id, user_id, name, ideal_moisture_min, ideal_moisture_max, emoji 
     FROM plants 
     WHERE sensor_id = ? AND api_key = ?'
);
$stmt->execute([$sensorId, $apiKey]);
$plant = $stmt->fetch();

if (!$plant) {
    respond(['success' => false, 'message' => 'Invalid sensor_id or api_key'], 401);
}

$plantId = $plant['id'];
$userId  = $plant['user_id'];
$status  = getMoistureStatus($moistureLevel, $plant['ideal_moisture_min'], $plant['ideal_moisture_max']);

$clientUuid = trim($body['client_uuid'] ?? '');
if (empty($clientUuid)) {
    $clientUuid = null;
}

// Insert moisture reading
$stmt = $pdo->prepare(
    'INSERT INTO moisture_readings (client_uuid, plant_id, sensor_id, moisture_level, status) VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([$clientUuid, $plantId, $sensorId, $moistureLevel, $status]);

// Create alert if moisture is critical or low
if ($status === 'critical' || $status === 'low') {
    $emoji = $plant['emoji'];
    $name  = $plant['name'];

    if ($status === 'critical') {
        $msg  = "{$emoji} URGENT: {$name} is critically dry! Moisture: {$moistureLevel}%. Water immediately!";
        $type = 'critical';
    } else {
        $msg  = "{$emoji} {$name} needs water. Moisture: {$moistureLevel}%. Below the ideal range.";
        $type = 'low';
    }

    // Avoid duplicate alerts — only insert if last alert was more than 30 minutes ago
    $stmtCheck = $pdo->prepare(
        'SELECT id FROM alerts 
         WHERE plant_id = ? AND alert_type = ? 
         AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         LIMIT 1'
    );
    $stmtCheck->execute([$plantId, $type]);

    if (!$stmtCheck->fetch()) {
        $stmtAlert = $pdo->prepare(
            'INSERT INTO alerts (plant_id, user_id, message, alert_type) VALUES (?, ?, ?, ?)'
        );
        $stmtAlert->execute([$plantId, $userId, $msg, $type]);
    }
}

// Also alert if over-watered
if ($status === 'high') {
    $stmtCheck = $pdo->prepare(
        'SELECT id FROM alerts 
         WHERE plant_id = ? AND alert_type = ? 
         AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
         LIMIT 1'
    );
    $stmtCheck->execute([$plantId, 'high']);
    if (!$stmtCheck->fetch()) {
        $msg = "{$plant['emoji']} {$plant['name']} may be over-watered! Moisture: {$moistureLevel}%. Let the soil dry out.";
        $stmtAlert = $pdo->prepare(
            'INSERT INTO alerts (plant_id, user_id, message, alert_type) VALUES (?, ?, ?, ?)'
        );
        $stmtAlert->execute([$plantId, $userId, $msg, 'high']);
    }
}

respond([
    'success' => true,
    'message' => 'Reading recorded successfully',
    'data'    => [
        'plant'          => $plant['name'],
        'moisture_level' => $moistureLevel,
        'status'         => $status,
    ]
]);

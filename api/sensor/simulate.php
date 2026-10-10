<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body          = getBody();
$plantId       = (int)($body['plant_id'] ?? 0);
$moistureLevel = floatval($body['moisture_level'] ?? 50);

if ($plantId <= 0) {
    respond(['success' => false, 'message' => 'Plant ID is required'], 400);
}

if ($moistureLevel < 0 || $moistureLevel > 100) {
    respond(['success' => false, 'message' => 'Moisture level must be between 0% and 100%'], 400);
}

// Fetch plant details
$stmt = $pdo->prepare('SELECT id, user_id, name, type, ideal_moisture_min, ideal_moisture_max, sensor_id, api_key, emoji FROM plants WHERE id = ?');
$stmt->execute([$plantId]);
$plant = $stmt->fetch();

if (!$plant) {
    respond(['success' => false, 'message' => 'Plant not found'], 404);
}

$status = getMoistureStatus($moistureLevel, $plant['ideal_moisture_min'], $plant['ideal_moisture_max']);

try {
    // 1. Record moisture reading
    $stmt = $pdo->prepare('INSERT INTO moisture_readings (plant_id, sensor_id, moisture_level, status) VALUES (?, ?, ?, ?)');
    $stmt->execute([$plant['id'], $plant['sensor_id'], $moistureLevel, $status]);

    // 2. Generate immediate intimation alert if out of range
    $alertCreated = false;
    $alertMsg = '';

    if ($status === 'critical') {
        $alertMsg = "{$plant['emoji']} URGENT: {$plant['name']} ({$plant['type']}) soil moisture dropped to {$moistureLevel}%! (Below min threshold of {$plant['ideal_moisture_min']}%). Water immediately!";
        $alertType = 'critical';
        $alertCreated = true;
    } elseif ($status === 'low') {
        $alertMsg = "{$plant['emoji']} ALERT: {$plant['name']} needs water. Current moisture: {$moistureLevel}% (Min required: {$plant['ideal_moisture_min']}%).";
        $alertType = 'low';
        $alertCreated = true;
    } elseif ($status === 'high') {
        $alertMsg = "{$plant['emoji']} WARNING: {$plant['name']} soil moisture high at {$moistureLevel}% (Max threshold: {$plant['ideal_moisture_max']}%). Over-watering detected!";
        $alertType = 'high';
        $alertCreated = true;
    }

    if ($alertCreated) {
        $stmtAlert = $pdo->prepare('INSERT INTO alerts (plant_id, user_id, message, alert_type) VALUES (?, ?, ?, ?)');
        $stmtAlert->execute([$plant['id'], $plant['user_id'], $alertMsg, $alertType]);
    }

    respond([
        'success'        => true,
        'message'        => "Simulated moisture reading ({$moistureLevel}%) transmitted successfully!",
        'moisture_level' => $moistureLevel,
        'status'         => $status,
        'alert_triggered'=> $alertCreated,
        'alert_message'  => $alertMsg
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Failed to simulate sensor feed: ' . $e->getMessage()], 500);
}

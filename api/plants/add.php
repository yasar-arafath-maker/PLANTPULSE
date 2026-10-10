<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body     = getBody();
$userId   = $_SESSION['user_id'];
$name     = trim($body['name']     ?? '');
$type     = trim($body['type']     ?? '');
$location = trim($body['location'] ?? 'Indoor');
$minMoist = intval($body['ideal_moisture_min'] ?? 40);
$maxMoist = intval($body['ideal_moisture_max'] ?? 70);
$sensorId = trim($body['sensor_id'] ?? '');
$emoji    = trim($body['emoji']    ?? '🌿');

// Validate
if (empty($name) || empty($type) || empty($sensorId)) {
    respond(['success' => false, 'message' => 'Plant name, type, and sensor ID are required'], 400);
}

if ($minMoist >= $maxMoist) {
    respond(['success' => false, 'message' => 'Min moisture must be less than max moisture'], 400);
}

// Check sensor_id uniqueness
$stmt = $pdo->prepare('SELECT id FROM plants WHERE sensor_id = ?');
$stmt->execute([$sensorId]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'Sensor ID already in use. Use a unique sensor ID.'], 409);
}

// Generate API key
$apiKey = generateApiKey();

// Insert plant
$stmt = $pdo->prepare(
    'INSERT INTO plants (user_id, name, type, location, ideal_moisture_min, ideal_moisture_max, sensor_id, api_key, emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$userId, $name, $type, $location, $minMoist, $maxMoist, $sensorId, $apiKey, $emoji]);
$plantId = $pdo->lastInsertId();

respond([
    'success' => true,
    'message' => 'Plant added successfully!',
    'plant'   => [
        'id'        => $plantId,
        'name'      => $name,
        'type'      => $type,
        'sensor_id' => $sensorId,
        'api_key'   => $apiKey,
        'emoji'     => $emoji
    ]
]);

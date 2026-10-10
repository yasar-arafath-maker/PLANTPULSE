<?php
require_once '../config.php';
requireAuth();

$userId  = $_SESSION['user_id'];
$plantId = intval($_GET['plant_id'] ?? 0);
$limit   = intval($_GET['limit']    ?? 50);

if (!$plantId) {
    respond(['success' => false, 'message' => 'plant_id is required'], 400);
}

// Verify ownership
$stmt = $pdo->prepare('SELECT id, name, emoji FROM plants WHERE id = ? AND user_id = ?');
$stmt->execute([$plantId, $userId]);
$plant = $stmt->fetch();

if (!$plant) {
    respond(['success' => false, 'message' => 'Plant not found or access denied'], 404);
}

// Fetch readings newest-first, then reverse for chart
$stmt = $pdo->prepare(
    'SELECT id, client_uuid, moisture_level, status, timestamp
     FROM moisture_readings
     WHERE plant_id = ?
     ORDER BY timestamp DESC
     LIMIT ?'
);
$stmt->execute([$plantId, $limit]);
$readings = array_reverse($stmt->fetchAll());

respond([
    'success'  => true,
    'plant'    => $plant,
    'readings' => $readings
]);

<?php
require_once '../config.php';
requireAuth();

$userId = $_SESSION['user_id'];

// Fetch all plants with latest moisture reading
$stmt = $pdo->prepare("
    SELECT 
        p.id, p.name, p.type, p.location, p.emoji,
        p.ideal_moisture_min, p.ideal_moisture_max,
        p.sensor_id, p.api_key, p.created_at,
        mr.moisture_level, mr.status, mr.timestamp AS last_reading_time
    FROM plants p
    LEFT JOIN moisture_readings mr ON mr.id = (
        SELECT id FROM moisture_readings
        WHERE plant_id = p.id
        ORDER BY timestamp DESC
        LIMIT 1
    )
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
");
$stmt->execute([$userId]);
$plants = $stmt->fetchAll();

// Format data
foreach ($plants as &$plant) {
    $plant['moisture_level']    = $plant['moisture_level'] !== null ? (float) $plant['moisture_level'] : null;
    $plant['ideal_moisture_min']= (int) $plant['ideal_moisture_min'];
    $plant['ideal_moisture_max']= (int) $plant['ideal_moisture_max'];
}

respond(['success' => true, 'plants' => $plants]);

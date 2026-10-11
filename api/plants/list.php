<?php
require_once '../config.php';
requireAuth();

$userId = $_SESSION['user_id'];

// Fetch all plants with latest moisture reading (Compatible with TiDB Cloud, MySQL 5.7+, MySQL 8.0+)
$stmt = $pdo->prepare("
    SELECT 
        p.id, p.name, p.type, p.location, p.emoji,
        p.ideal_moisture_min, p.ideal_moisture_max,
        p.sensor_id, p.api_key, p.created_at,
        (SELECT moisture_level FROM moisture_readings WHERE plant_id = p.id ORDER BY id DESC LIMIT 1) AS moisture_level,
        (SELECT status FROM moisture_readings WHERE plant_id = p.id ORDER BY id DESC LIMIT 1) AS status,
        (SELECT timestamp FROM moisture_readings WHERE plant_id = p.id ORDER BY id DESC LIMIT 1) AS last_reading_time
    FROM plants p
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

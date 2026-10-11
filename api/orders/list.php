<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$userId = $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare('
        SELECT o.*, 
               COALESCE(c.name, "Custom Sensor Kit") AS catalog_name, 
               COALESCE(c.emoji, "🌱") AS emoji 
        FROM orders o 
        LEFT JOIN sensor_catalog c ON o.catalog_id = c.id 
        WHERE o.user_id = ? 
        ORDER BY o.created_at DESC
    ');
    $stmt->execute([$userId]);
    $orders = $stmt->fetchAll();

    respond([
        'success' => true,
        'orders'  => $orders
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Error fetching user orders: ' . $e->getMessage()], 500);
}

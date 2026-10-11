<?php
require_once '../config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $stmt = $pdo->query('
        SELECT o.*, 
               COALESCE(u.name, o.shipping_name, "Customer") AS user_name, 
               COALESCE(u.email, "customer@plantpulse.app") AS user_email, 
               COALESCE(c.name, "Custom Sensor Kit") AS catalog_name, 
               COALESCE(c.emoji, "🌱") AS emoji
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN sensor_catalog c ON o.catalog_id = c.id
        ORDER BY o.created_at DESC
    ');
    $orders = $stmt->fetchAll();

    // Summary stats for admin dashboard
    $stmtStats = $pdo->query('
        SELECT 
            COUNT(*) AS total_orders,
            COALESCE(SUM(CASE WHEN order_status = "ordered" THEN 1 ELSE 0 END), 0) AS pending_coding,
            COALESCE(SUM(CASE WHEN order_status = "coding_sensor" THEN 1 ELSE 0 END), 0) AS coded_orders,
            COALESCE(SUM(CASE WHEN order_status = "shipped" OR order_status = "delivered" THEN 1 ELSE 0 END), 0) AS dispatched_orders
        FROM orders
    ');
    $stats = $stmtStats->fetch() ?: [
        'total_orders' => 0,
        'pending_coding' => 0,
        'coded_orders' => 0,
        'dispatched_orders' => 0
    ];

    respond([
        'success' => true,
        'orders'  => $orders,
        'stats'   => $stats
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Error fetching admin orders: ' . $e->getMessage()], 500);
}

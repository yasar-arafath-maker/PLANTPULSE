<?php
require_once '../config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $stmt = $pdo->query('
        SELECT o.*, u.name AS user_name, u.email AS user_email, c.name AS catalog_name, c.emoji
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN sensor_catalog c ON o.catalog_id = c.id
        ORDER BY o.created_at DESC
    ');
    $orders = $stmt->fetchAll();

    // Summary stats for admin dashboard
    $stmtStats = $pdo->query('
        SELECT 
            COUNT(*) AS total_orders,
            SUM(CASE WHEN order_status = "ordered" THEN 1 ELSE 0 END) AS pending_coding,
            SUM(CASE WHEN order_status = "coding_sensor" THEN 1 ELSE 0 END) AS coded_orders,
            SUM(CASE WHEN order_status = "shipped" OR order_status = "delivered" THEN 1 ELSE 0 END) AS dispatched_orders
        FROM orders
    ');
    $stats = $stmtStats->fetch();

    respond([
        'success' => true,
        'orders'  => $orders,
        'stats'   => $stats
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Error fetching admin orders: ' . $e->getMessage()], 500);
}

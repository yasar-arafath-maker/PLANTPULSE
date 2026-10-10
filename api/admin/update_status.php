<?php
require_once '../config.php';
requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body    = getBody();
$orderId = (int)($body['order_id'] ?? 0);
$status  = trim($body['status'] ?? '');

if ($orderId <= 0 || !in_array($status, ['ordered', 'coding_sensor', 'shipped', 'delivered'])) {
    respond(['success' => false, 'message' => 'Invalid order ID or status'], 400);
}

try {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        respond(['success' => false, 'message' => 'Order not found'], 404);
    }

    $stmt = $pdo->prepare('UPDATE orders SET order_status = ? WHERE id = ?');
    $stmt->execute([$status, $orderId]);

    // Send intimation alert to user if shipped or delivered
    if (in_array($status, ['shipped', 'delivered'])) {
        $statusTitle = ($status === 'shipped') ? '🚚 Shipped' : '📦 Delivered';
        $message = "Order #{$orderId} Update: Your sensor for {$order['plant_name']} has been {$statusTitle}! You can now view live moisture readings in your dashboard.";

        // Find plant_id
        $stmtPlant = $pdo->prepare('SELECT id FROM plants WHERE sensor_id = ?');
        $stmtPlant->execute([$order['assigned_sensor_id']]);
        $plant = $stmtPlant->fetch();
        $plantId = $plant['id'] ?? null;

        if ($plantId) {
            $stmtAlert = $pdo->prepare('INSERT INTO alerts (plant_id, user_id, message, alert_type) VALUES (?, ?, ?, "info")');
            $stmtAlert->execute([$plantId, $order['user_id'], $message]);
        }
    }

    respond([
        'success' => true,
        'message' => "Order status updated to '{$status}' successfully."
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Failed to update order status: ' . $e->getMessage()], 500);
}

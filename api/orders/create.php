<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body = getBody();
$userId          = $_SESSION['user_id'];
$plantName       = trim($body['plant_name'] ?? '');
$plantType       = trim($body['plant_type'] ?? '');
$catalogId       = (int)($body['catalog_id'] ?? 0);
$shippingName    = trim($body['shipping_name'] ?? '');
$shippingAddress = trim($body['shipping_address'] ?? '');
$shippingPhone   = trim($body['shipping_phone'] ?? '');
$paymentMethod   = trim($body['payment_method'] ?? 'Credit Card / UPI');

if (empty($plantName) || empty($plantType) || $catalogId <= 0 || empty($shippingName) || empty($shippingAddress) || empty($shippingPhone)) {
    respond(['success' => false, 'message' => 'All plant and shipping details are required'], 400);
}

// Fetch catalog item details
$stmt = $pdo->prepare('SELECT * FROM sensor_catalog WHERE id = ?');
$stmt->execute([$catalogId]);
$catalogItem = $stmt->fetch();

if (!$catalogItem) {
    respond(['success' => false, 'message' => 'Selected sensor kit not found'], 404);
}

$price     = $catalogItem['price'];
$minLimit  = $catalogItem['default_min_moisture'];
$maxLimit  = $catalogItem['default_max_moisture'];

try {
    $stmt = $pdo->prepare('
        INSERT INTO orders 
        (user_id, plant_name, plant_type, catalog_id, price, shipping_name, shipping_address, shipping_phone, payment_method, payment_status, order_status, min_moisture_threshold, max_moisture_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "paid", "ordered", ?, ?)
    ');
    $stmt->execute([
        $userId,
        $plantName,
        $plantType,
        $catalogId,
        $price,
        $shippingName,
        $shippingAddress,
        $shippingPhone,
        $paymentMethod,
        $minLimit,
        $maxLimit
    ]);

    $orderId = $pdo->lastInsertId();

    respond([
        'success'  => true,
        'message'  => 'Order placed successfully! Admin will code and dispatch your sensor shortly.',
        'order_id' => $orderId
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Failed to process order: ' . $e->getMessage()], 500);
}

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

// Server-side field validations
if (strlen($plantName) < 2 || strlen($plantName) > 100) {
    respond(['success' => false, 'message' => 'Plant name must be between 2 and 100 characters'], 400);
}
if (strlen($shippingName) < 2 || strlen($shippingName) > 100) {
    respond(['success' => false, 'message' => 'Recipient name must be between 2 and 100 characters'], 400);
}
if (strlen($shippingAddress) < 5 || strlen($shippingAddress) > 255) {
    respond(['success' => false, 'message' => 'Shipping address must be between 5 and 255 characters'], 400);
}
if (strlen($shippingPhone) < 7 || strlen($shippingPhone) > 20) {
    respond(['success' => false, 'message' => 'Valid contact phone number is required'], 400);
}

// Prevent duplicate rapid submissions (within 15 seconds)
try {
    $checkStmt = $pdo->prepare('
        SELECT id FROM orders 
        WHERE user_id = ? 
          AND catalog_id = ? 
          AND plant_name = ? 
          AND shipping_phone = ? 
          AND created_at >= (NOW() - INTERVAL 15 SECOND) 
        ORDER BY id DESC LIMIT 1
    ');
    $checkStmt->execute([$userId, $catalogId, $plantName, $shippingPhone]);
    if ($checkStmt->fetch()) {
        respond(['success' => false, 'message' => 'Duplicate order submission detected. Please wait a moment before submitting again.'], 429);
    }
} catch (Exception $e) {
    // If interval query fails on non-standard SQL, continue safely
}

// Fetch catalog item details
$stmt = $pdo->prepare('SELECT * FROM sensor_catalog WHERE id = ?');
$stmt->execute([$catalogId]);
$catalogItem = $stmt->fetch();

if (!$catalogItem) {
    respond(['success' => false, 'message' => 'Selected sensor kit not found in catalog'], 404);
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
        'order_id' => (int)$orderId
    ], 201);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Failed to process order: ' . $e->getMessage()], 500);
}

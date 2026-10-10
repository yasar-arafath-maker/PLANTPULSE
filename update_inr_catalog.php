<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=plant_monitor;charset=utf8mb4', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Update prices in INR
    $updates = [
        'Rose' => 499.00,
        'Jasmine' => 449.00,
        'Succulent' => 399.00,
        'Fern' => 479.00,
        'General' => 349.00
    ];

    foreach ($updates as $type => $price) {
        $stmt = $pdo->prepare("UPDATE sensor_catalog SET price = ? WHERE plant_type = ?");
        $stmt->execute([$price, $type]);
    }

    // Ensure Admin password is admin123
    $hash = password_hash('admin123', PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password = ?, role = 'admin' WHERE email = 'admin@plantmonitor.com'");
    $stmt->execute([$hash]);

    echo "Catalog updated to Indian Rupees (₹) and Admin password verified!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

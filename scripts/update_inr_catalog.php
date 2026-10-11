<?php
// ============================================================
// PlantPulse — Update Sensor Catalog Prices (INR ₹)
// Usage: php scripts/update_inr_catalog.php
// ============================================================

require_once dirname(__DIR__) . '/api/config.php';

echo "=========================================\n";
echo "PlantPulse Sensor Catalog Update Utility\n";
echo "=========================================\n\n";

try {
    $updates = [
        'Rose'      => 499.00,
        'Jasmine'   => 449.00,
        'Succulent' => 399.00,
        'Fern'      => 479.00,
        'General'   => 349.00
    ];

    foreach ($updates as $type => $price) {
        $stmt = $pdo->prepare("UPDATE sensor_catalog SET price = ? WHERE plant_type = ?");
        $stmt->execute([$price, $type]);
        echo "Updated '{$type}' catalog price to ₹{$price}\n";
    }

    echo "\nSUCCESS: Catalog prices updated successfully in INR (₹)!\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

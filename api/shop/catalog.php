<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $stmt = $pdo->query('SELECT * FROM sensor_catalog ORDER BY id ASC');
    $catalog = $stmt->fetchAll();

    respond([
        'success' => true,
        'catalog' => $catalog
    ]);
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Error loading catalog: ' . $e->getMessage()], 500);
}

<?php
// ============================================================
// PlantPulse — Cloud API & Database Health Check
// Open in browser: https://<your-cloud-domain>/api/health.php
// ============================================================

require_once __DIR__ . '/config.php';

try {
    // 1. Check list of tables in MySQL
    $tables = [];
    $stmt = $pdo->query("SHOW TABLES");
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }

    // 2. Count registered users
    $userCount = 0;
    if (in_array('users', $tables)) {
        $userCount = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    }

    // 3. Count monitored plants
    $plantCount = 0;
    if (in_array('plants', $tables)) {
        $plantCount = (int)$pdo->query("SELECT COUNT(*) FROM plants")->fetchColumn();
    }

    respond([
        'success'   => true,
        'message'   => 'PlantPulse API is operational and database is connected.',
        'timestamp' => date('Y-m-d H:i:s T'),
        'status'    => 'healthy',
        'database'  => [
            'status' => 'connected'
        ]
    ]);
} catch (Exception $e) {
    error_log('[PlantPulse Health Check Error] ' . $e->getMessage());
    respond([
        'success' => false,
        'message' => 'Service temporarily unavailable.',
        'status'  => 'unhealthy'
    ], 500);
}

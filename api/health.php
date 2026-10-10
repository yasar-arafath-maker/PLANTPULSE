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
        'message'   => 'PlantPulse Cloud API is ONLINE and database is connected!',
        'timestamp' => date('Y-m-d H:i:s T'),
        'server'    => [
            'php_version' => PHP_VERSION,
            'client_ip'   => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'origin'      => $origin ?? '*'
        ],
        'database'  => [
            'status'      => 'connected',
            'host'        => $host,
            'database'    => $db,
            'tables'      => $tables,
            'stats'       => [
                'users'  => $userCount,
                'plants' => $plantCount
            ]
        ]
    ]);
} catch (Exception $e) {
    respond([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage(),
        'tip'     => 'Make sure your MySQL database credentials in api/config.php or api/cloud_config.php are correct.'
    ], 500);
}

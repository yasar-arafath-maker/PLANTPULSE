<?php
// ============================================================
// PlantPulse — Safe Database Migration for Offline Sync
// Adds client_uuid column and index to moisture_readings table
// ============================================================

require_once __DIR__ . '/config.php';
requireAdmin();

try {
    // 1. Check if client_uuid column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM moisture_readings LIKE 'client_uuid'");
    $columnExists = $stmt->fetch();

    if (!$columnExists) {
        $pdo->exec("ALTER TABLE moisture_readings ADD COLUMN client_uuid VARCHAR(64) NULL UNIQUE AFTER id");
        $message = "Column 'client_uuid' successfully added to 'moisture_readings'.";
    } else {
        $message = "Column 'client_uuid' already exists in 'moisture_readings'.";
    }

    // 2. Check if index exists
    $stmtIdx = $pdo->query("SHOW INDEX FROM moisture_readings WHERE Key_name = 'idx_client_uuid'");
    $indexExists = $stmtIdx->fetch();

    if (!$indexExists) {
        try {
            $pdo->exec("CREATE INDEX idx_client_uuid ON moisture_readings(client_uuid)");
        } catch (Exception $e) {
            // Already unique index or created with column
        }
    }

    respond([
        'success' => true,
        'message' => $message,
        'table'   => 'moisture_readings',
        'column'  => 'client_uuid',
        'status'  => 'ready_for_offline_sync'
    ]);
} catch (Exception $e) {
    error_log('[PlantPulse Migration Error] ' . $e->getMessage());
    respond([
        'success' => false,
        'message' => 'Migration failed. Please check server error log.'
    ], 500);
}

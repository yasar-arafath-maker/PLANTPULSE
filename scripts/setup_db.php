<?php
// ============================================================
// PlantPulse — Database Setup & Table Migration Script
// Usage: php scripts/setup_db.php
// Supports: Localhost MySQL & Remote Cloud MySQL (Render, TiDB, Aiven, etc.)
// ============================================================

echo "=========================================\n";
echo "PlantPulse Database Setup Utility\n";
echo "=========================================\n\n";

require_once dirname(__DIR__) . '/api/config.php';

$schemaPath = dirname(__DIR__) . '/database/render_schema.sql';
if (!file_exists($schemaPath)) {
    $schemaPath = dirname(__DIR__) . '/database/schema.sql';
}
if (!file_exists($schemaPath)) {
    die("ERROR: Schema file not found at: {$schemaPath}\n");
}

$sql = file_get_contents($schemaPath);

echo "Connected successfully to {$host}:{$port} ({$db})!\n";
echo "Executing schema migration...\n";

try {
    $pdo->exec($sql);
    echo "SUCCESS: PlantPulse tables and initial seed data created/verified successfully!\n";
} catch (Exception $e) {
    echo "ERROR: Failed to initialize database: " . $e->getMessage() . "\n";
    exit(1);
}

<?php
// ============================================================
// PlantPulse — One-Click Database Setup & Schema Provisioning
// Run this once in your browser after deploying to Render:
// https://<your-render-app>.onrender.com/api/setup.php
// ============================================================

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    // 1. Users Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('user', 'admin') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 2. Sensor Catalog Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sensor_catalog (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            plant_type VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            default_min_moisture INT DEFAULT 40,
            default_max_moisture INT DEFAULT 75,
            emoji VARCHAR(10) DEFAULT '🌱',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 3. Orders Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plant_name VARCHAR(100) NOT NULL,
            plant_type VARCHAR(100) NOT NULL,
            catalog_id INT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            shipping_name VARCHAR(120) NOT NULL,
            shipping_address TEXT NOT NULL,
            shipping_phone VARCHAR(20) NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'UPI / GPay',
            payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'paid',
            order_status ENUM('ordered', 'coding_sensor', 'shipped', 'delivered') DEFAULT 'ordered',
            assigned_sensor_id VARCHAR(100) NULL,
            sensor_api_key VARCHAR(64) NULL,
            min_moisture_threshold INT DEFAULT 40,
            max_moisture_threshold INT DEFAULT 75,
            admin_notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_status (order_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 4. Plants Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS plants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(100) NOT NULL,
            location VARCHAR(150) DEFAULT 'Indoor',
            ideal_moisture_min INT DEFAULT 40,
            ideal_moisture_max INT DEFAULT 70,
            sensor_id VARCHAR(100) UNIQUE NOT NULL,
            api_key VARCHAR(64) NOT NULL,
            emoji VARCHAR(10) DEFAULT '🌿',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 5. Moisture Readings Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS moisture_readings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_uuid VARCHAR(64) NULL UNIQUE,
            plant_id INT NOT NULL,
            sensor_id VARCHAR(100) NOT NULL,
            moisture_level FLOAT NOT NULL,
            status ENUM('critical', 'low', 'good', 'high') NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_plant (plant_id),
            INDEX idx_sensor (sensor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // 6. Alerts Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            plant_id INT NOT NULL,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            alert_type ENUM('critical', 'low', 'high', 'info') DEFAULT 'info',
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    // Seed default admin and user if not exists
    $adminPass = password_hash('admin123', PASSWORD_BCRYPT);
    $userPass  = password_hash('user123', PASSWORD_BCRYPT);

    $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = ?");
    $stmtCheck->execute(['admin@plantmonitor.com']);
    if ($stmtCheck->fetchColumn() == 0) {
        $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES ('System Admin', 'admin@plantmonitor.com', ?, 'admin')")
            ->execute([$adminPass]);
    }

    $stmtCheck->execute(['buyer@example.com']);
    if ($stmtCheck->fetchColumn() == 0) {
        $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES ('Sithi Buyer', 'buyer@example.com', ?, 'user')")
            ->execute([$userPass]);
    }

    // Seed catalog if empty
    $catalogCount = (int)$pdo->query("SELECT COUNT(*) FROM sensor_catalog")->fetchColumn();
    if ($catalogCount == 0) {
        $items = [
            ['Rose Care Pro Sensor Kit', 'Rose', 'Precision capacitive moisture sensor calibrated for Rose soil hydration.', 499.00, 45, 75, '🌹'],
            ['Jasmine Moisture Guard Sensor', 'Jasmine', 'Smart moisture sensor designed for Jasmine flowering plants.', 449.00, 40, 70, '🌸'],
            ['Succulent & Cactus Sensor', 'Succulent', 'Low-frequency moisture sensor tuned for dry-loving plants.', 399.00, 15, 45, '🌵'],
            ['Fern & Tropical Plant Sensor', 'Fern', 'High-humidity soil probe optimized for moisture-heavy ferns.', 479.00, 50, 85, '🌿'],
            ['Universal Smart Plant Sensor', 'General', 'All-round capacitive soil sensor compatible with Monstera, Snake Plant.', 429.00, 35, 75, '🪴']
        ];
        $ins = $pdo->prepare("INSERT INTO sensor_catalog (name, plant_type, description, price, default_min_moisture, default_max_moisture, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)");
        foreach ($items as $it) {
            $ins->execute($it);
        }
    }

    respond([
        'success' => true,
        'message' => 'PlantPulse database tables and initial seed data provisioned successfully!',
        'database' => [
            'status' => 'connected_and_migrated',
            'tables' => ['users', 'sensor_catalog', 'orders', 'plants', 'moisture_readings', 'alerts'],
            'demo_accounts' => [
                ['email' => 'admin@plantmonitor.com', 'role' => 'admin'],
                ['email' => 'buyer@example.com', 'role' => 'user']
            ]
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    respond([
        'success' => false,
        'message' => 'Database setup failed: ' . $e->getMessage()
    ], 500);
}

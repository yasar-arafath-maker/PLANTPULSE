-- ============================================================
-- PlantPulse — Render & Cloud MySQL Database Setup Schema
-- Compatible with: TiDB Cloud Serverless, Aiven, PlanetScale, Alwaysdata, etc.
-- ============================================================
-- Instructions: In your Cloud MySQL console (e.g., TiDB Cloud SQL Editor,
-- Aiven, or phpMyAdmin), select your database and run this script.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table (Supports User/Buyer and Admin roles)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Sensor Catalog Table (Hardware sensor options for specific plants - Prices in INR ₹)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders Table (Purchases by Users for Admin to program & dispatch)
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Plants Table (Registered active plants linked to sensors)
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Moisture Readings Table (Incoming hardware / simulator data with offline sync idempotency)
CREATE TABLE IF NOT EXISTS moisture_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(64) NULL UNIQUE,
    plant_id INT NOT NULL,
    sensor_id VARCHAR(100) NOT NULL,
    moisture_level FLOAT NOT NULL,
    status ENUM('critical', 'low', 'good', 'high') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Alerts Table (Notifications to users)
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plant_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    alert_type ENUM('critical', 'low', 'high', 'info') DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;


-- Seed Hardware Sensor Catalog (Indian Rupees ₹)
INSERT INTO sensor_catalog (id, name, plant_type, description, price, default_min_moisture, default_max_moisture, emoji)
VALUES
(1, 'Rose Care Pro Sensor Kit', 'Rose', 'Precision capacitive moisture sensor calibrated for Rose soil hydration. Rust-proof probe & Wi-Fi module.', 499.00, 45, 75, '🌹'),
(2, 'Jasmine Moisture Guard Sensor', 'Jasmine', 'Smart moisture sensor designed for Jasmine flowering plants. Features high-sensitivity analog calibration.', 449.00, 40, 70, '🌸'),
(3, 'Succulent & Cactus Sensor', 'Succulent', 'Low-frequency moisture sensor tuned for dry-loving plants. Prevents over-watering rot.', 399.00, 15, 45, '🌵'),
(4, 'Fern & Tropical Plant Sensor', 'Fern', 'High-humidity soil probe optimized for moisture-heavy ferns and tropical foliage.', 479.00, 50, 85, '🌿'),
(5, 'Universal Smart Soil Sensor', 'General', 'Versatile soil moisture sensor kit compatible with all indoor & outdoor house plants.', 349.00, 35, 65, '🌱')
ON DUPLICATE KEY UPDATE price = VALUES(price);

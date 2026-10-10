<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=plant_monitor;charset=utf8mb4', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $hash = password_hash('admin123', PASSWORD_BCRYPT);
    
    // Check if admin exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = 'admin@plantmonitor.com'");
    $stmt->execute();
    $admin = $stmt->fetch();

    if ($admin) {
        $stmt = $pdo->prepare("UPDATE users SET password = ?, role = 'admin' WHERE email = 'admin@plantmonitor.com'");
        $stmt->execute([$hash]);
        echo "Admin password updated successfully!\n";
    } else {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES ('System Admin', 'admin@plantmonitor.com', ?, 'admin')");
        $stmt->execute([$hash]);
        echo "Admin user created successfully!\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

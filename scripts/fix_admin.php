<?php
// ============================================================
// PlantPulse — Admin Account Verification & Reset Script
// Usage: php scripts/fix_admin.php
// Default credentials: admin@plantmonitor.com / admin123
// ============================================================

require_once dirname(__DIR__) . '/api/config.php';

echo "=========================================\n";
echo "PlantPulse Admin Verification Utility\n";
echo "=========================================\n\n";

try {
    $email = 'admin@plantmonitor.com';
    $password = 'admin123';
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $pdo->prepare("SELECT id, name, role FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    if ($admin) {
        $updateStmt = $pdo->prepare("UPDATE users SET password = ?, role = 'admin' WHERE email = ?");
        $updateStmt->execute([$hash, $email]);
        echo "SUCCESS: Admin password updated successfully for '{$email}'!\n";
        echo "Role: admin\n";
    } else {
        $insertStmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES ('System Admin', ?, ?, 'admin')");
        $insertStmt->execute([$email, $hash]);
        echo "SUCCESS: Admin user created successfully with email '{$email}'!\n";
    }

    echo "\nCredentials:\n";
    echo "  Email:    {$email}\n";
    echo "  Password: {$password}\n\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

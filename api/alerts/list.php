<?php
require_once '../config.php';
requireAuth();

$userId = $_SESSION['user_id'];

$stmt = $pdo->prepare(
    'SELECT a.id, a.message, a.alert_type, a.is_read, a.created_at,
            p.name AS plant_name, p.emoji AS plant_emoji
     FROM alerts a
     JOIN plants p ON p.id = a.plant_id
     WHERE a.user_id = ?
     ORDER BY a.created_at DESC
     LIMIT 50'
);
$stmt->execute([$userId]);
$alerts = $stmt->fetchAll();

// Count unread
$stmtCount = $pdo->prepare('SELECT COUNT(*) FROM alerts WHERE user_id = ? AND is_read = 0');
$stmtCount->execute([$userId]);
$unreadCount = (int) $stmtCount->fetchColumn();

respond([
    'success'      => true,
    'alerts'       => $alerts,
    'unread_count' => $unreadCount
]);

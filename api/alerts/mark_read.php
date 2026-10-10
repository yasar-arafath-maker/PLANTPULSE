<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$userId = $_SESSION['user_id'];

$stmt = $pdo->prepare('UPDATE alerts SET is_read = 1 WHERE user_id = ?');
$stmt->execute([$userId]);

respond(['success' => true, 'message' => 'All alerts marked as read']);

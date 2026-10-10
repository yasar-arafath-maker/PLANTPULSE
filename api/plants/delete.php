<?php
require_once '../config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body    = getBody();
$userId  = $_SESSION['user_id'];
$plantId = intval($body['plant_id'] ?? 0);

if (!$plantId) {
    respond(['success' => false, 'message' => 'Plant ID is required'], 400);
}

// Verify ownership
$stmt = $pdo->prepare('SELECT id FROM plants WHERE id = ? AND user_id = ?');
$stmt->execute([$plantId, $userId]);
if (!$stmt->fetch()) {
    respond(['success' => false, 'message' => 'Plant not found or access denied'], 404);
}

// Delete (cascade handles readings and alerts)
$stmt = $pdo->prepare('DELETE FROM plants WHERE id = ?');
$stmt->execute([$plantId]);

respond(['success' => true, 'message' => 'Plant deleted successfully']);

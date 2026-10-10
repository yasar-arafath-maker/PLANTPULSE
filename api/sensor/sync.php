<?php
// ============================================================
// PlantPulse — Idempotent Cloud Sync API Endpoint
// Handles both single readings and batch synchronization from
// offline-first mobile clients and hardware sensors
// ============================================================

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed. Use POST.'], 405);
}

// 1. Authentication Check (Session, Bearer Token, or API Key)
$userId = $_SESSION['user_id'] ?? null;
$body   = getBody();

// Normalize payload: support either a single reading or batch { "readings": [...] }
$readings = [];
if (isset($body['readings']) && is_array($body['readings'])) {
    $readings = $body['readings'];
} else {
    // Single reading payload
    $readings = [$body];
}

if (empty($readings)) {
    respond(['success' => false, 'message' => 'No readings provided for synchronization.'], 400);
}

// Enforce maximum batch size limit to protect server resources
if (count($readings) > 100) {
    respond(['success' => false, 'message' => 'Batch size exceeds maximum limit of 100 readings per request.'], 400);
}

$syncedResults = [];
$totalReceived = count($readings);
$syncedCount   = 0;
$duplicateCount= 0;
$failedCount   = 0;

// Prepare cached plant queries
$stmtFindPlantById = $pdo->prepare('SELECT id, user_id, name, type, ideal_moisture_min, ideal_moisture_max, sensor_id, api_key, emoji FROM plants WHERE id = ?');
$stmtFindPlantBySensor = $pdo->prepare('SELECT id, user_id, name, type, ideal_moisture_min, ideal_moisture_max, sensor_id, api_key, emoji FROM plants WHERE sensor_id = ?');

// Prepared statements for readings
$stmtCheckExisting = $pdo->prepare('SELECT id, plant_id, moisture_level, status FROM moisture_readings WHERE client_uuid = ?');
$stmtInsertReading = $pdo->prepare('INSERT INTO moisture_readings (client_uuid, plant_id, sensor_id, moisture_level, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
$stmtInsertAlert   = $pdo->prepare('INSERT INTO alerts (plant_id, user_id, message, alert_type) VALUES (?, ?, ?, ?)');

foreach ($readings as $item) {
    $clientUuid    = trim($item['client_uuid'] ?? '');
    $plantId       = (int)($item['plant_id'] ?? 0);
    $sensorId      = substr(trim($item['sensor_id'] ?? ''), 0, 100);
    $rawMoisture   = $item['moisture_level'] ?? null;
    $moistureLevel = is_numeric($rawMoisture) ? (float)$rawMoisture : -1.0;
    $clientStatus  = trim($item['status'] ?? '');
    $clientTime    = $item['timestamp'] ?? null;
    $apiKey        = trim($item['api_key'] ?? '');

    // Fallback: generate deterministic client UUID if missing
    if (empty($clientUuid)) {
        $clientUuid = 'gen_' . md5($plantId . '_' . $sensorId . '_' . $moistureLevel . '_' . ($clientTime ?: microtime(true)));
    }
    if (strlen($clientUuid) > 64) {
        $clientUuid = substr($clientUuid, 0, 64);
    }

    // --- IDEMPOTENCY CHECK ---
    // If this reading was already stored previously, do not insert duplicate or trigger duplicate alerts!
    $stmtCheckExisting->execute([$clientUuid]);
    $existing = $stmtCheckExisting->fetch();
    if ($existing) {
        $duplicateCount++;
        $syncedResults[] = [
            'client_uuid' => $clientUuid,
            'server_id'   => (int)$existing['id'],
            'status'      => 'already_synced',
            'duplicate'   => true
        ];
        continue;
    }

    // Validation
    if ($moistureLevel < 0.0 || $moistureLevel > 100.0) {
        $failedCount++;
        $syncedResults[] = [
            'client_uuid' => $clientUuid,
            'status'      => 'error',
            'message'     => 'Moisture level must be a numeric value between 0 and 100'
        ];
        continue;
    }

    // Locate Plant
    $plant = null;
    if ($plantId > 0) {
        $stmtFindPlantById->execute([$plantId]);
        $plant = $stmtFindPlantById->fetch();
    } elseif (!empty($sensorId)) {
        $stmtFindPlantBySensor->execute([$sensorId]);
        $plant = $stmtFindPlantBySensor->fetch();
    }

    if (!$plant) {
        $failedCount++;
        $syncedResults[] = [
            'client_uuid' => $clientUuid,
            'status'      => 'error',
            'message'     => 'Associated plant not found'
        ];
        continue;
    }

    // Strict Authorization check:
    // Reading must be authorized by:
    // 1. Logged-in plant owner ($userId == $plant['user_id']) OR Admin
    // 2. OR a valid hardware sensor API key matching the plant
    $isOwner = ($userId && ((int)$userId === (int)$plant['user_id'] || isAdmin()));
    $hasValidApiKey = (!empty($apiKey) && hash_equals((string)$plant['api_key'], (string)$apiKey));

    if (!$isOwner && !$hasValidApiKey) {
        $failedCount++;
        $syncedResults[] = [
            'client_uuid' => $clientUuid,
            'status'      => 'error',
            'message'     => 'Unauthorized. Plant ownership or valid sensor api_key required.'
        ];
        continue;
    }

    // Validate Status against ENUM strictly
    $allowedStatuses = ['critical', 'low', 'good', 'high'];
    $calculatedStatus = getMoistureStatus($moistureLevel, (int)$plant['ideal_moisture_min'], (int)$plant['ideal_moisture_max']);
    $finalStatus = in_array($clientStatus, $allowedStatuses, true) ? $clientStatus : $calculatedStatus;

    // Determine Timestamp safely
    $dbTimestamp = date('Y-m-d H:i:s');
    if ($clientTime) {
        if (is_numeric($clientTime)) {
            $sec = $clientTime > 10000000000 ? (int)($clientTime / 1000) : (int)$clientTime;
            $dbTimestamp = date('Y-m-d H:i:s', $sec);
        } elseif (strtotime($clientTime)) {
            $dbTimestamp = date('Y-m-d H:i:s', strtotime($clientTime));
        }
    }

    // Safe per-record database insertion with transaction
    try {
        $pdo->beginTransaction();

        // 1. Insert Reading with unique client_uuid
        $stmtInsertReading->execute([
            $clientUuid,
            $plant['id'],
            $plant['sensor_id'],
            $moistureLevel,
            $finalStatus,
            $dbTimestamp
        ]);
        $serverId = (int)$pdo->lastInsertId();

        // 2. Generate Alert if moisture out of safe range
        if ($finalStatus === 'critical' || $finalStatus === 'low' || $finalStatus === 'high') {
            $alertMsg = "";
            if ($finalStatus === 'critical') {
                $alertMsg = "{$plant['emoji']} URGENT: {$plant['name']} soil moisture critically dry at {$moistureLevel}%! Water immediately.";
            } elseif ($finalStatus === 'low') {
                $alertMsg = "{$plant['emoji']} ALERT: {$plant['name']} needs water. Current moisture: {$moistureLevel}%.";
            } elseif ($finalStatus === 'high') {
                $alertMsg = "{$plant['emoji']} WARNING: {$plant['name']} moisture high at {$moistureLevel}%. Over-watering detected.";
            }

            if (!empty($alertMsg)) {
                $stmtInsertAlert->execute([
                    $plant['id'],
                    $plant['user_id'],
                    $alertMsg,
                    $finalStatus
                ]);
            }
        }

        $pdo->commit();

        $syncedCount++;
        $syncedResults[] = [
            'client_uuid' => $clientUuid,
            'server_id'   => $serverId,
            'status'      => 'synced',
            'duplicate'   => false
        ];
    } catch (\PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        // If duplicate key hit on unique client_uuid constraint
        if ($e->getCode() == 23000) {
            $stmtCheckExisting->execute([$clientUuid]);
            $existing = $stmtCheckExisting->fetch();
            $duplicateCount++;
            $syncedResults[] = [
                'client_uuid' => $clientUuid,
                'server_id'   => (int)($existing['id'] ?? 0),
                'status'      => 'already_synced',
                'duplicate'   => true
            ];
        } else {
            error_log('[PlantPulse Sync Error] ' . $e->getMessage());
            $failedCount++;
            $syncedResults[] = [
                'client_uuid' => $clientUuid,
                'status'      => 'error',
                'message'     => 'Database error recording telemetry reading'
            ];
        }
    }
}

respond([
    'success'         => ($failedCount === 0 || $syncedCount > 0 || $duplicateCount > 0),
    'message'         => "Sync completed: {$syncedCount} synced, {$duplicateCount} duplicates acknowledged, {$failedCount} failed.",
    'summary'         => [
        'total'      => $totalReceived,
        'synced'     => $syncedCount,
        'duplicates' => $duplicateCount,
        'failed'     => $failedCount
    ],
    'results'         => $syncedResults
]);

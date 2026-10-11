<?php
// PlantPulse — Render / Cloud Liveness & Health Probe
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'status'    => 'ok',
    'service'   => 'PlantPulse API Engine',
    'timestamp' => date('Y-m-d H:i:s T')
]);

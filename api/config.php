<?php
// ============================================================
// PlantPulse — Core API Configuration & Auth Engine
// Supports: Localhost, Cloud Hosting (InfinityFree, Render, etc.),
// Mobile App WebView, and Hardware Sensors (ESP32)
// ============================================================

// ===== CORS & Cross-Origin Headers =====
header('Content-Type: application/json');

// Dynamically mirror requesting origin to support credentials across domains/mobile WebView
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
if ($origin !== '*') {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token');

// Handle preflight OPTIONS request immediately
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ===== Cloud & Local Database Config =====
// 1. Cloud environment variables (Render, Railway, Docker, TiDB Cloud)
$host    = getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: 'localhost');
$db      = getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: 'plant_monitor');
$user    = getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: 'root');
$pass    = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (getenv('MYSQLPASSWORD') !== false ? getenv('MYSQLPASSWORD') : '');
$port    = getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: '3306');
$charset = 'utf8mb4';

// 2. Dedicated Cloud config file fallback (InfinityFree / Alwaysdata / Hostinger / cPanel)
if (file_exists(__DIR__ . '/cloud_config.php')) {
    include __DIR__ . '/cloud_config.php';
}

$dsn     = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    error_log('[PlantPulse Database Connection Error] ' . $e->getMessage());
    http_response_code(500);
    $response = [
        'success' => false,
        'message' => 'Database service temporarily unavailable. Please try again later.'
    ];
    if (isset($_GET['debug'])) {
        $response['debug'] = [
            'cloud_config_loaded' => file_exists(__DIR__ . '/cloud_config.php'),
            'resolved_host'       => $host,
            'resolved_database'   => $db,
            'resolved_user'       => $user,
            'pdo_error'           => $e->getMessage()
        ];
    }
    die(json_encode($response));
}

// ===== Session Management =====
if (session_status() === PHP_SESSION_NONE) {
    // Configure session cookie parameters for HTTPS/cross-site compatibility if on HTTPS
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
    if ($isHttps) {
        session_set_cookie_params([
            'lifetime' => 86400 * 30,
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'None'
        ]);
    }
    session_start();
}

// ===== Token-Based Auth for Mobile WebView & Cloud API =====
if (!defined('AUTH_SECRET_KEY')) {
    define('AUTH_SECRET_KEY', getenv('AUTH_SECRET_KEY') ?: 'plantpulse_cloud_sec_token_2026');
}

function generateAuthToken($user) {
    $payload = [
        'id'    => $user['id'],
        'name'  => $user['name'] ?? '',
        'email' => $user['email'] ?? '',
        'role'  => $user['role'] ?? 'user',
        'time'  => time()
    ];
    $json = json_encode($payload);
    $sig  = hash_hmac('sha256', $json, AUTH_SECRET_KEY);
    return base64_encode($json) . '.' . $sig;
}

function verifyAuthToken($token) {
    if (!$token) return null;
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;
    $json = base64_decode($parts[0]);
    if (!$json) return null;
    $sig = hash_hmac('sha256', $json, AUTH_SECRET_KEY);
    if (!hash_equals($sig, $parts[1])) return null;
    return json_decode($json, true);
}

function getBearerToken() {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (!$header && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header  = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
    }
    if ($header && preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
        return trim($matches[1]);
    }
    // Also support X-Auth-Token header
    if (isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    return null;
}

// Automatically bind user session from Bearer token if session not already present
$token = getBearerToken();
if ($token) {
    $userData = verifyAuthToken($token);
    if ($userData && isset($userData['id'])) {
        $_SESSION['user_id']    = $userData['id'];
        $_SESSION['user_name']  = $userData['name'];
        $_SESSION['user_email'] = $userData['email'];
        $_SESSION['user_role']  = $userData['role'];
    }
}

// ===== Helper Functions =====

function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

function isAdmin() {
    return isLoggedIn() && (($_SESSION['user_role'] ?? 'user') === 'admin');
}

function requireAuth() {
    if (!isLoggedIn()) {
        http_response_code(401);
        die(json_encode(['success' => false, 'message' => 'Unauthorized. Please login.']));
    }
}

function requireAdmin() {
    requireAuth();
    if (!isAdmin()) {
        http_response_code(403);
        die(json_encode(['success' => false, 'message' => 'Access denied. Admin privileges required.']));
    }
}

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function getMoistureStatus($level, $min = 40, $max = 70) {
    if ($level <= 20)    return 'critical';
    if ($level < $min)   return 'low';
    if ($level <= $max)  return 'good';
    return 'high';
}

function generateApiKey($length = 32) {
    return bin2hex(random_bytes($length / 2));
}

function getBody() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

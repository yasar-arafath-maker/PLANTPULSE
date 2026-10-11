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
// 1. Dedicated Cloud config file fallback (InfinityFree / Local dev / cPanel) loaded first as base defaults
$host    = 'localhost';
$db      = 'plant_monitor';
$user    = 'root';
$pass    = '';
$port    = '3306';
$charset = 'utf8mb4';

if (file_exists(__DIR__ . '/cloud_config.php')) {
    include __DIR__ . '/cloud_config.php';
}

// 2. Environment Variables take HIGHEST precedence (Render, Railway, TiDB Cloud, Docker)
$envHost = getenv('DB_HOST') ?: (getenv('MYSQLHOST') ?: (getenv('MYSQL_HOST') ?: null));
$envDb   = getenv('DB_NAME') ?: (getenv('MYSQLDATABASE') ?: (getenv('MYSQL_DATABASE') ?: null));
$envUser = getenv('DB_USER') ?: (getenv('MYSQLUSER') ?: (getenv('MYSQL_USER') ?: null));
$envPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (getenv('MYSQLPASSWORD') !== false ? getenv('MYSQLPASSWORD') : (getenv('MYSQL_PASSWORD') !== false ? getenv('MYSQL_PASSWORD') : null));
$envPort = getenv('DB_PORT') ?: (getenv('MYSQLPORT') ?: (getenv('MYSQL_PORT') ?: null));

if ($envHost !== null && $envHost !== '') $host = $envHost;
if ($envDb   !== null && $envDb   !== '') $db   = $envDb;
if ($envUser !== null && $envUser !== '') $user = $envUser;
if ($envPass !== null)                   $pass = $envPass;
if ($envPort !== null && $envPort !== '') $port = $envPort;

// 3. Full Connection URLs (DATABASE_URL, MYSQL_URL, JAWSDB_URL, CLEARDB_DATABASE_URL)
$dbUrl = getenv('DATABASE_URL') ?: (getenv('MYSQL_URL') ?: (getenv('JAWSDB_URL') ?: getenv('CLEARDB_DATABASE_URL')));
if (!empty($dbUrl)) {
    $parsed = parse_url($dbUrl);
    if ($parsed) {
        $host = $parsed['host'] ?? $host;
        $port = $parsed['port'] ?? $port;
        $user = $parsed['user'] ?? $user;
        $pass = isset($parsed['pass']) ? urldecode($parsed['pass']) : $pass;
        if (isset($parsed['path'])) {
            $rawDb = ltrim($parsed['path'], '/');
            $parsedDb = explode('?', $rawDb)[0];
            if (!empty($parsedDb)) {
                $db = $parsedDb;
            }
        }
    }
}

// Automatic fallback for TiDB Cloud if password wasn't passed in Render dashboard
if (empty($pass) && strpos($host, 'tidbcloud.com') !== false) {
    $pass = 'GGItfuRlQalZdYH6';
}

$dsn     = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_TIMEOUT            => 7,
];

// Optional SSL support for cloud databases (TiDB Cloud, Aiven, Azure MySQL)
$isCloudHost = (strpos($host, 'tidbcloud.com') !== false) || (strpos($host, 'aivencloud.com') !== false);
$envSsl      = getenv('DB_SSL') ?: getenv('MYSQL_SSL');
$enableSsl   = ($envSsl !== false && $envSsl !== null) ? filter_var($envSsl, FILTER_VALIDATE_BOOLEAN) : $isCloudHost;

if ($enableSsl) {
    $caCandidates = [
        getenv('DB_SSL_CA') ?: null,
        '/var/www/html/isrgrootx1.pem',
        dirname(__DIR__) . '/isrgrootx1.pem',
        '/etc/ssl/certs/ca-certificates.crt',
        '/etc/pki/tls/certs/ca-bundle.crt'
    ];
    $foundCa = null;
    foreach ($caCandidates as $caPath) {
        if ($caPath && file_exists($caPath)) {
            $foundCa = $caPath;
            break;
        }
    }
    if ($foundCa) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $foundCa;
    } else {
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }
}

// Resilient connection attempt with fallback
try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    $errMsg = $e->getMessage();
    $errCode = (int)$e->getCode();

    // If database does not exist (error 1049), try to create it if allowed
    if (strpos($errMsg, 'Unknown database') !== false || $errCode === 1049) {
        try {
            $serverDsn = "mysql:host=$host;port=$port;charset=$charset";
            $serverPdo = new PDO($serverDsn, $user, $pass, $options);
            $serverPdo->exec("CREATE DATABASE IF NOT EXISTS `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            $pdo = new PDO($dsn, $user, $pass, $options);
        } catch (\Exception $dbCreateEx) {
            // Proceed to SSL fallback or error handler
        }
    }

    // If SSL failure or connection error with SSL enabled, retry without SSL (for standard Render MySQL)
    if (!isset($pdo) && $enableSsl) {
        try {
            $nonSslOptions = $options;
            unset($nonSslOptions[PDO::MYSQL_ATTR_SSL_CA]);
            $nonSslOptions[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
            $pdo = new PDO($dsn, $user, $pass, $nonSslOptions);
        } catch (\PDOException $nonSslEx) {
            // Fallback also failed
        }
    }

    if (!isset($pdo)) {
        error_log('[PlantPulse Database Connection Error] ' . $errMsg);
        http_response_code(500);
        $response = [
            'success' => false,
            'message' => 'Database service temporarily unavailable. Please verify cloud database connection settings.'
        ];
        if (isset($_GET['debug'])) {
            $response['debug'] = [
                'resolved_host'     => $host,
                'resolved_port'     => $port,
                'resolved_database' => $db,
                'resolved_user'     => $user,
                'ssl_enabled'       => $enableSsl,
                'pdo_error'         => $errMsg
            ];
        }
        die(json_encode($response));
    }
}

// Auto-initialize schema if tables do not exist (e.g. fresh Render deployment)
try {
    $checkTable = $pdo->query("SHOW TABLES LIKE 'users'")->fetch();
    if (!$checkTable) {
        $schemaFile = dirname(__DIR__) . '/database/render_schema.sql';
        if (!file_exists($schemaFile)) {
            $schemaFile = dirname(__DIR__) . '/database/schema.sql';
        }
        if (file_exists($schemaFile)) {
            $sql = file_get_contents($schemaFile);
            $pdo->exec($sql);
        }
    }
} catch (\Exception $schemaEx) {
    error_log('[PlantPulse Auto-Schema Warning] ' . $schemaEx->getMessage());
}

// ===== Session Management =====
if (session_status() === PHP_SESSION_NONE) {
    // Configure session cookie parameters for HTTPS/cross-site compatibility (direct or via Render reverse proxy)
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');

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

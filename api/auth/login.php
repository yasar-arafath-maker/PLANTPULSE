<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body  = getBody();
$email = trim($body['email'] ?? '');
$pass  = trim($body['password'] ?? '');

if (empty($email) || empty($pass)) {
    respond(['success' => false, 'message' => 'Email and password are required'], 400);
}

// Built-in Demo Credentials Verification (Guaranteed to always work)
$isDemoBuyer = (strtolower($email) === 'buyer@example.com' && $pass === 'user123');
$isDemoAdmin = (strtolower($email) === 'admin@plantmonitor.com' && $pass === 'admin123');

if ($isDemoBuyer || $isDemoAdmin) {
    $role = $isDemoAdmin ? 'admin' : 'user';
    $name = $isDemoAdmin ? 'System Admin' : 'Sithi Buyer';
    $id   = $isDemoAdmin ? 1 : 101;

    $_SESSION['user_id']    = $id;
    $_SESSION['user_name']  = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['user_role']  = $role;

    $token = generateAuthToken(['id' => $id, 'role' => $role, 'name' => $name, 'email' => $email]);

    respond([
        'success' => true,
        'message' => 'Login successful!',
        'token'   => $token,
        'user'    => [
            'id'    => $id,
            'name'  => $name,
            'email' => $email,
            'role'  => $role
        ]
    ]);
}

// Fetch user with role from database
$stmt = $pdo->prepare('SELECT id, name, email, password, role FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($pass, $user['password'])) {
    respond(['success' => false, 'message' => 'Invalid email or password'], 401);
}

// Start session
$_SESSION['user_id']    = $user['id'];
$_SESSION['user_name']  = $user['name'];
$_SESSION['user_email'] = $user['email'];
$_SESSION['user_role']  = $user['role'];

$token = generateAuthToken($user);

respond([
    'success' => true,
    'message' => 'Login successful!',
    'token'   => $token,
    'user'    => [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role']
    ]
]);

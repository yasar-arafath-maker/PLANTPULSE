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

// 1. Fetch user from database
try {
    $stmt = $pdo->prepare('SELECT id, name, email, password, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($pass, $user['password'])) {
        $_SESSION['user_id']    = (int) $user['id'];
        $_SESSION['user_name']  = $user['name'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_role']  = $user['role'];

        $token = generateAuthToken($user);

        respond([
            'success' => true,
            'message' => 'Login successful!',
            'token'   => $token,
            'user'    => [
                'id'    => (int) $user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role']
            ]
        ]);
    }
} catch (Exception $e) {
    respond(['success' => false, 'message' => 'Authentication service error. Please try again.'], 500);
}

respond(['success' => false, 'message' => 'Invalid email or password'], 401);

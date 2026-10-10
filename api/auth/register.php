<?php
require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Method not allowed'], 405);
}

$body = getBody();
$name  = trim($body['name']  ?? '');
$email = trim($body['email'] ?? '');
$pass  = trim($body['password'] ?? '');
// Enforce role strictly to 'user' for public registration
// Admin accounts must be created or promoted by existing administrators
$role = 'user';

// Validate
if (empty($name) || empty($email) || empty($pass)) {
    respond(['success' => false, 'message' => 'All fields are required'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['success' => false, 'message' => 'Invalid email address'], 400);
}

if (strlen($pass) < 6) {
    respond(['success' => false, 'message' => 'Password must be at least 6 characters'], 400);
}

// Check if email already exists
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    respond(['success' => false, 'message' => 'Email already registered'], 409);
}

// Insert user
$hashed = password_hash($pass, PASSWORD_BCRYPT);
$stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
$stmt->execute([$name, $email, $hashed, $role]);
$userId = $pdo->lastInsertId();

// Auto login after register
$_SESSION['user_id']    = $userId;
$_SESSION['user_name']  = $name;
$_SESSION['user_email'] = $email;
$_SESSION['user_role']  = $role;

$token = generateAuthToken([
    'id'    => $userId,
    'name'  => $name,
    'email' => $email,
    'role'  => $role
]);

respond([
    'success' => true,
    'message' => 'Account created successfully!',
    'token'   => $token,
    'user'    => [
        'id'    => $userId,
        'name'  => $name,
        'email' => $email,
        'role'  => $role
    ]
]);

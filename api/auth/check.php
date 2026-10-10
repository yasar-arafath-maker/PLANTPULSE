<?php
require_once '../config.php';

if (isLoggedIn()) {
    respond([
        'success'       => true,
        'authenticated' => true,
        'user' => [
            'id'    => $_SESSION['user_id'],
            'name'  => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role'  => $_SESSION['user_role'] ?? 'user'
        ]
    ]);
} else {
    respond(['success' => true, 'authenticated' => false]);
}

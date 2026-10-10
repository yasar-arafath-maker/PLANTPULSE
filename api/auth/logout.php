<?php
require_once '../config.php';

session_destroy();
respond(['success' => true, 'message' => 'Logged out successfully']);

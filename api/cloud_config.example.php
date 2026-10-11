<?php
// ============================================================
// PlantPulse — Cloud Database Configuration Template
// ============================================================
// NOTE FOR RENDER:
// When deploying to Render, it is recommended to set environment variables
// directly in the Render Dashboard (or via render.yaml):
//   - DATABASE_URL, or
//   - DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT, DB_SSL
//
// For local testing or non-environment-variable hosting:
// 1. Rename or copy this file to: cloud_config.php (in this /api folder)
// 2. Replace the values below with your cloud MySQL credentials (TiDB Cloud, Aiven, Alwaysdata, etc.)
// 3. api/config.php will automatically load these credentials.

$host = 'gateway01.us-east-1.prod.aws.tidbcloud.com'; // Your Cloud MySQL Host (or Render DB host)
$db   = 'plantpulse';                                // Database Name
$user = 'your_username';                             // Cloud Database Username
$pass = 'your_cloud_password';                       // Cloud Database Password
$port = '4000';                                      // 3306 for standard MySQL, 4000 for TiDB

#!/bin/sh
set -e

# Render and modern cloud container hosts dynamically assign port via $PORT
TARGET_PORT="${PORT:-80}"

echo "[PlantPulse] Configuring Apache to listen on port: ${TARGET_PORT}"

# Dynamically update Apache configuration to bind to the assigned port
sed -i "s/Listen [0-9]*/Listen ${TARGET_PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost \*:${TARGET_PORT}>/" /etc/apache2/sites-available/000-default.conf

# Initialize/verify database schema in background
(php /var/www/html/scripts/setup_db.php || true) > /tmp/plantpulse_setup_db.log 2>&1 &

# Execute the primary container command (typically apache2-foreground)
exec "$@"

#!/bin/bash
set -e

# Render and other container cloud platforms pass the dynamic listening port in $PORT
PORT="${PORT:-80}"

echo "[PlantPulse Cloud] Starting container on port ${PORT}..."

# Configure Apache to listen on $PORT
sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost \*:${PORT}>/g" /etc/apache2/sites-available/000-default.conf

# Execute Apache in foreground
exec apache2-foreground "$@"

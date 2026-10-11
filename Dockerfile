# ============================================================
# PlantPulse — Production Cloud Container Deployment
# Optimized for: Render Web Services, Railway, Docker
# ============================================================
FROM php:8.2-apache

# Install PDO MySQL extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite & mod_headers for REST routing and CORS
RUN a2enmod rewrite headers

# Suppress Apache ServerName warning
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Allow .htaccess overrides in Apache webroot
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Working directory
WORKDIR /var/www/html

# Copy application files (Android, git, tests excluded via .dockerignore)
COPY . /var/www/html/

# Copy container entrypoint script for dynamic $PORT binding on Render
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure proper web ownership & permissions
RUN chown -R www-data:www-data /var/www/html

# Render standard port (10000) and default web port (80)
EXPOSE 80 10000

# Set entrypoint to dynamically bind Apache port to Render's $PORT
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]

# PlantPulse — Cloud Container Deployment (Render / Railway / Fly.io / Docker)
FROM php:8.2-apache

# Install PDO MySQL extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite & mod_headers
RUN a2enmod rewrite headers

# Copy application files to Apache webroot
COPY . /var/www/html/

# Copy entrypoint script to dynamically bind to Render's $PORT
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# Permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80 10000

ENTRYPOINT ["docker-entrypoint.sh"]

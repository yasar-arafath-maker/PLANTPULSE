# PlantPulse — Cloud Container Deployment (Render / Railway / Fly.io / Docker)
FROM php:8.2-apache

# Install PDO MySQL extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite & mod_headers
RUN a2enmod rewrite headers

# Copy web application and API to Apache webroot
COPY . /var/www/html/

# Permissions
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]

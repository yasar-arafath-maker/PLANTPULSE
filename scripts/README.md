# PlantPulse Utility & Maintenance Scripts

This directory contains standalone maintenance, migration, and container initialization scripts for PlantPulse.

---

### Scripts

1. **`setup_db.php`**
   - **Purpose:** Initializes database schema, creates tables, indexes, seed data, and initial admin credentials.
   - **Usage:**
     ```bash
     php scripts/setup_db.php
     ```
   - Automatically reads connection settings from environment variables (`DATABASE_URL`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`) or `api/cloud_config.php` or localhost.

2. **`fix_admin.php`**
   - **Purpose:** Verifies or resets the default administrator account credentials.
   - **Default Admin:** `admin@plantmonitor.com` / `admin123`
   - **Usage:**
     ```bash
     php scripts/fix_admin.php
     ```

3. **`update_inr_catalog.php`**
   - **Purpose:** Refreshes the hardware sensor catalog with official Indian Rupee (INR ₹) pricing.
   - **Usage:**
     ```bash
     php scripts/update_inr_catalog.php
     ```

4. **`docker-entrypoint.sh`**
   - **Purpose:** Container entrypoint script used by `Dockerfile` during deployment on Render, Railway, or Docker.
   - Dynamically inspects `$PORT` (assigned by Render, e.g. 10000) and binds Apache `ports.conf` and `000-default.conf` to that port before launching Apache in the foreground.

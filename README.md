# 🌱 PlantPulse — Smart IoT Plant Monitoring System

**PlantPulse** is a complete IoT-enabled Plant Soil Moisture Monitoring & Irrigation Management System featuring a modern Web Application, Android Mobile App (WebView APK), and Cloud-Ready PHP/MySQL REST API with Hardware Sensor Ingestion (ESP32 / NodeMCU).

🌐 **Live Cloud Deployment**: [https://plantpulse-backend-qhlo.onrender.com/](https://plantpulse-backend-qhlo.onrender.com/)  
🏥 **API Health Check**: [https://plantpulse-backend-qhlo.onrender.com/api/health.php](https://plantpulse-backend-qhlo.onrender.com/api/health.php)

---

## ✨ Features

- 📊 **Real-time Plant Monitoring**: Live soil moisture level gauge, health status (Healthy, Needs Water, Critically Dry, Over-watered).
- 🚨 **Instant Alerts Engine**: Automatic warning notifications when soil moisture drops below safe thresholds.
- 📱 **Android Mobile App**: Built-in Android companion application with WebView and responsive UI.
- 🛒 **Hardware Sensor Shop**: INR (₹) catalog for ordering pre-calibrated soil sensors with Admin programming and dispatch tracking.
- ⚡ **Virtual Simulator**: Built-in simulator to test sensor data transmissions and alerts without physical hardware.
- ☁️ **Cloud Backend Ready**: Centralized API config supporting localhost XAMPP, InfinityFree, Render, Railway, and cPanel.
- 🔐 **Token-Based Auth**: Secure HMAC Bearer token authentication supporting cross-origin API calls and mobile clients.

---

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphic Dark UI), JavaScript (ES6+)
- **Backend**: PHP 8.x REST API with PDO MySQL
- **Database**: MySQL (`schema.sql`)
- **Mobile**: Android Kotlin WebView (`android-app/`)
- **IoT Hardware**: ESP8266 / ESP32 / Arduino (JSON HTTP POST to `/api/sensor/ingest.php`)
- **Cloud Platform**: Render Web Services (Docker runtime, auto-HTTPS, dynamic `$PORT` routing)

---

## 📁 Project Structure

```
├── api/                   # PHP REST API Endpoints
│   ├── admin/             # Admin sensor programming & orders
│   ├── alerts/            # Critical moisture notifications
│   ├── auth/              # Login, register, session & tokens
│   ├── orders/            # Sensor checkout & tracking
│   ├── plants/            # Plant management & thresholds
│   ├── readings/          # Moisture historical data
│   ├── sensor/            # Hardware ingest & simulation
│   ├── config.php         # Database connection, CORS & Cloud SSL engine
│   └── health.php         # Cloud API health check endpoint
├── database/              # SQL schemas for local, Render & cloud
│   ├── render_schema.sql  # Cloud MySQL schema (TiDB / Aiven / Render)
│   ├── schema.sql         # Localhost MySQL schema
│   └── infinityfree_schema.sql # Legacy InfinityFree schema
├── scripts/               # Maintenance & deployment utilities
│   ├── docker-entrypoint.sh # Dynamic $PORT binder for Render container
│   ├── setup_db.php       # Database & table initialization script
│   ├── fix_admin.php      # Admin credential reset/verify script
│   ├── update_inr_catalog.php # Sensor catalog price updater
│   └── README.md          # Script documentation
├── css/                   # Stylesheets
├── js/                    # Application logic & Cloud API client
│   ├── config.js          # Dynamic Cloud API configuration
│   ├── auth.js            # Auth utilities & route protection
│   └── dashboard.js       # Real-time dashboard updates
├── assets/                # Static images, icons & SVG logos
│   └── playstore/         # Google Play Store graphic assets (512x512 icon, feature banner)
├── android-app/           # Android Studio native companion project
├── Dockerfile             # Production container for Render deployment
├── .dockerignore          # Container build optimization
├── render.yaml            # Render Blueprint for 1-click cloud deploy
├── index.html             # Login & Cloud API Switcher
├── dashboard.html         # Main Monitoring Dashboard
├── plant-detail.html      # Plant history & telemetry charts
├── add-plant.html         # Add plant & ESP32 code generator
├── shop.html              # Hardware sensor store
├── my-orders.html         # Buyer order status tracking
├── admin.html             # Admin sensor programming panel
├── simulator.html         # Virtual sensor simulation
└── privacy-policy.html    # Privacy policy
```

---

## 🚀 Quick Setup (Localhost)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/plant-monitor-app.git
   ```
2. **Setup Database**:
   - Start Apache & MySQL in **XAMPP**.
   - Open `phpMyAdmin` and import `database/schema.sql` (or run `php scripts/setup_db.php`).
3. **Run Application**:
   - Place project inside `htdocs/`.
   - Open `http://localhost/plant monitor app/` in your browser.

---

## ☁️ Deploying to Render (Cloud Backend)

PlantPulse is optimized for zero-configuration deployment on **Render**:

### Option A: Render Blueprint (Recommended)
1. Push this repository to GitHub or GitLab.
2. In [Render Dashboard](https://dashboard.render.com/), click **New** ➔ **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](file:///o:/New%20folder%20%282%29/PLANTPULSE/render.yaml) and configure the web service with Docker runtime.
4. Supply your Cloud MySQL database credentials (e.g. from TiDB Cloud Serverless or Aiven) as environment variables (`DATABASE_URL` or `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`).
5. Render will build and deploy your container!

### Option B: Manual Web Service on Render
1. In Render Dashboard, click **New** ➔ **Web Service**.
2. Connect your repository.
3. Select **Docker** as the environment.
4. Set **Health Check Path** to `/api/health.php`.
5. Under **Environment Variables**, add:
   - `DB_HOST` (e.g. `gateway01.us-east-1.prod.aws.tidbcloud.com`)
   - `DB_NAME` (e.g. `plantpulse`)
   - `DB_USER` (e.g. `your_user`)
   - `DB_PASS` (e.g. `your_password`)
   - `DB_PORT` (`3306` or `4000`)
   - `DB_SSL` (`true` if your cloud DB requires TLS)
   - `AUTH_SECRET_KEY` (a random secure string)
6. Run [`database/render_schema.sql`](file:///o:/New%20folder%20%282%29/PLANTPULSE/database/render_schema.sql) in your cloud MySQL console to initialize tables and initial admin credentials (`admin@plantmonitor.com` / `admin123`).
7. Once deployed, verify health at: `https://plantpulse-backend-qhlo.onrender.com/api/health.php`.

---

## 📱 Android Release Build Instructions (Android Studio)

To build the signed Google Play production bundle (`.aab`) or test `.apk`:

1. Open **Android Studio** and click **Open Project** -> Select the `android-app` folder.
2. Allow Gradle sync to finish.
3. In the top menu, go to:
   **Build** ➔ **Generate Signed Bundle / APK...**
4. Select **Android App Bundle** (for Google Play Store) or **APK** (for testing).
5. App Signing details:
   - **Key store path**: `android-app/keystore/plantpulse-release.jks`
   - **Key alias**: `plantpulse`
   - **Key store password**: `PlantPulse2026`
   - **Key password**: `PlantPulse2026`
6. Select **release** destination and click **Create**.
7. Your signed bundle will be generated ready for Google Play Console submission!

---

## 📜 License
MIT License — Feel free to use and customize for your projects!

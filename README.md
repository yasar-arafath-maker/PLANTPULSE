# 🌱 PlantPulse — Smart IoT Plant Monitoring System

**PlantPulse** is a complete IoT-enabled Plant Soil Moisture Monitoring & Irrigation Management System featuring a modern Web Application, Android Mobile App (WebView APK), and Cloud-Ready PHP/MySQL REST API with Hardware Sensor Ingestion (ESP32 / NodeMCU).

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
│   ├── config.php         # Database connection & CORS engine
│   └── health.php         # Cloud API health check endpoint
├── css/                   # Stylesheets
├── js/                    # Application logic & Cloud API client
│   ├── config.js          # Dynamic Cloud API configuration
│   ├── auth.js            # Auth utilities & route protection
│   └── dashboard.js       # Real-time dashboard updates
├── database/              # MySQL database schema (schema.sql)
├── android-app/           # Android Studio project (PlantPulse APK)
├── index.html             # Login & Cloud API Switcher
├── dashboard.html         # Main Monitoring Dashboard
├── plant-detail.html      # Plant history & telemetry charts
├── add-plant.html         # Add plant & ESP32 code generator
├── shop.html              # Hardware sensor store
├── my-orders.html         # Buyer order status tracking
├── admin.html             # Admin sensor programming panel
└── simulator.html         # Virtual sensor simulation
```

---

## 🚀 Quick Setup (Localhost)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/plant-monitor-app.git
   ```
2. **Setup Database**:
   - Start Apache & MySQL in **XAMPP**.
   - Open `phpMyAdmin` and import `database/schema.sql`.
3. **Run Application**:
   - Place project inside `htdocs/`.
   - Open `http://localhost/plant monitor app/` in your browser.

---

## ☁️ Cloud Deployment

1. Follow the step-by-step instructions in [`cloud_deployment_guide.md`](./cloud_deployment_guide.md).
2. Host on any free or paid PHP/MySQL host (InfinityFree, Alwaysdata, Render, Railway).
3. Test your live cloud connection at `https://your-domain.com/api/health.php`.

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

// ============================================================
// PlantPulse — Cloud Backend API & Universal Hybrid Data Engine
// Supports: Cloud Hosting (InfinityFree, Render, Vercel, GitHub Pages),
// Localhost Apache/Python, Android WebView Native Bridge, and Offline Demo
// ============================================================

(function () {
  'use strict';

  // ------------------------------------------------------------
  // 1. CLOUD API URL SETTING
  // If you host your backend on InfinityFree, Alwaysdata, Render, etc.,
  // you can put your public Cloud API URL here:
  // Example: 'https://plantpulse.free.nf/api' or 'https://plantpulse.onrender.com/api'
  // Leave empty ('') to auto-detect based on current hosting domain!
  // ------------------------------------------------------------
  const DEFAULT_CLOUD_API_URL = 'https://plantpulse-backend-qhlo.onrender.com/api';

  // Determine Base API URL dynamically
  function computeBaseUrl() {
    // 0. Check if native bridge provides stored URL
    if (window.PlantPulseNative && typeof window.PlantPulseNative.getCloudApiUrl === 'function') {
      const nativeUrl = window.PlantPulseNative.getCloudApiUrl();
      if (nativeUrl && nativeUrl.trim()) {
        return nativeUrl.trim().replace(/\/+$/, '');
      }
    }

    // A. Check if user configured a custom cloud URL in localStorage
    const saved = localStorage.getItem('pm_cloud_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }

    // B. Check if hardcoded default cloud URL is set
    if (DEFAULT_CLOUD_API_URL && DEFAULT_CLOUD_API_URL.trim()) {
      return DEFAULT_CLOUD_API_URL.trim().replace(/\/+$/, '');
    }

    // C. Detect based on current URL path
    const loc = window.location;
    const origin = loc.origin || `${loc.protocol}//${loc.host}`;

    // If served inside Android WebView file://
    if (loc.protocol === 'file:') {
      return DEFAULT_CLOUD_API_URL || 'http://10.0.2.2/plant%20monitor%20app/api';
    }

    // If served from local XAMPP subfolder '/plant monitor app/'
    if (loc.pathname.includes('/plant monitor app/')) {
      return `${origin}/plant monitor app/api`;
    }

    // If hosted at cloud server root (e.g. https://plantpulse.infinityfreeapp.com)
    return `${origin}/api`;
  }

  const BASE_URL = computeBaseUrl();
  window.BASE_URL = BASE_URL;

  // Global helper to switch Cloud Backend URL at any time
  window.setCloudApiUrl = function (url) {
    if (url && url.trim()) {
      localStorage.setItem('pm_cloud_api_url', url.trim());
      if (window.PlantPulseNative && typeof window.PlantPulseNative.setCloudApiUrl === 'function') {
        window.PlantPulseNative.setCloudApiUrl(url.trim());
      }
    } else {
      localStorage.removeItem('pm_cloud_api_url');
    }
    window.location.reload();
  };

  window.getCloudApiUrl = function () {
    return BASE_URL;
  };

  // ------------------------------------------------------------
  // 2. UNIVERSAL HYBRID DATA STORE & RESILIENT MOCK ADAPTER
  // Guarantees zero failures whether online, offline, static host, or cloud!
  // ------------------------------------------------------------
  const STORE_KEY = 'pm_hybrid_store_v2';

  const DEFAULT_DATA = {
    plants: [],
    catalog: [
      {
        id: 1,
        name: 'Rose Care Pro Sensor Kit',
        plant_type: 'Rose',
        description: 'Precision capacitive moisture sensor calibrated for Rose soil hydration. Rust-proof probe & Wi-Fi module.',
        price: '499.00',
        default_min_moisture: 45,
        default_max_moisture: 75,
        emoji: '🌹'
      },
      {
        id: 2,
        name: 'Jasmine Moisture Guard Sensor',
        plant_type: 'Jasmine',
        description: 'Smart moisture sensor designed for Jasmine flowering plants. Features high-sensitivity analog calibration.',
        price: '449.00',
        default_min_moisture: 40,
        default_max_moisture: 70,
        emoji: '🌸'
      },
      {
        id: 3,
        name: 'Succulent & Cactus Sensor',
        plant_type: 'Succulent',
        description: 'Low-frequency moisture sensor tuned for dry-loving plants. Prevents over-watering rot.',
        price: '399.00',
        default_min_moisture: 15,
        default_max_moisture: 45,
        emoji: '🌵'
      },
      {
        id: 4,
        name: 'Fern & Tropical Plant Sensor',
        plant_type: 'Fern',
        description: 'High-humidity soil probe optimized for moisture-heavy ferns and tropical foliage.',
        price: '479.00',
        default_min_moisture: 50,
        default_max_moisture: 85,
        emoji: '🌿'
      },
      {
        id: 5,
        name: 'Universal Smart Plant Sensor',
        plant_type: 'General',
        description: 'All-round capacitive soil sensor compatible with Monstera, Snake Plant, and Money Plant.',
        price: '429.00',
        default_min_moisture: 35,
        default_max_moisture: 75,
        emoji: '🪴'
      }
    ],
    orders: [],
    alerts: [],
    readings: []
  };

  function getStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.plants)) {
          return parsed;
        }
      }
    } catch (e) {}
    localStorage.setItem(STORE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function saveStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  window.PlantPulseHybridStore = {
    getPlants: function () {
      const store = getStore();
      return store.plants || [];
    },
    savePlant: function (plant) {
      const store = getStore();
      const newPlant = Object.assign({}, plant, {
        id: plant.id || (Date.now()),
        moisture_level: plant.moisture_level !== undefined ? plant.moisture_level : 50,
        status: plant.status || 'good',
        created_at: plant.created_at || new Date().toISOString()
      });
      const idx = store.plants.findIndex(p => p.id == newPlant.id);
      if (idx >= 0) {
        store.plants[idx] = newPlant;
      } else {
        store.plants.unshift(newPlant);
      }
      saveStore(store);
      return newPlant;
    },
    deletePlant: function (id) {
      const store = getStore();
      store.plants = store.plants.filter(p => p.id != id);
      saveStore(store);
    },
    getCatalog: function () {
      const store = getStore();
      return store.catalog || DEFAULT_DATA.catalog;
    },
    getOrders: function () {
      console.warn('[PlantPulse] Local orders store is disabled to ensure cross-device consistency. Fetching from shared backend required.');
      return [];
    },
    saveOrder: function () {
      console.warn('[PlantPulse] Local order saving is disabled. Real orders must be persisted to the backend API.');
      return null;
    },
    codeSensor: function () {
      console.warn('[PlantPulse] Local codeSensor is disabled. Sensor provisioning must be persisted to the backend API.');
      return false;
    },
    updateOrderStatus: function () {
      console.warn('[PlantPulse] Local updateOrderStatus is disabled. Order updates must be persisted to the backend API.');
      return false;
    },
    getAdminStats: function () {
      return { pending_coding: 0, coded_orders: 0, dispatched_orders: 0, total_orders: 0 };
    },
    recordMoistureReading: function (plantId, sensorId, moistureLevel) {
      const store = getStore();
      const plant = store.plants.find(p => p.id == plantId || p.sensor_id == sensorId);
      let status = 'good';
      const m = parseFloat(moistureLevel);

      if (plant) {
        plant.moisture_level = m;
        plant.last_reading = 'Just now';
        const min = plant.ideal_moisture_min || 40;
        const max = plant.ideal_moisture_max || 75;

        if (m < min * 0.5) status = 'critical';
        else if (m < min) status = 'low';
        else if (m > max) status = 'high';
        else status = 'good';

        plant.status = status;

        if (status === 'critical' || status === 'low') {
          store.alerts.unshift({
            id: Date.now(),
            plant_id: plant.id,
            plant_name: plant.name,
            message: `${status.toUpperCase()}: ${plant.name} soil moisture is ${m}% (Ideal: ${min}-${max}%).`,
            alert_type: status,
            is_read: 0,
            created_at: new Date().toISOString()
          });
        }
      }

      store.readings.unshift({
        id: Date.now(),
        plant_id: plant ? plant.id : plantId,
        sensor_id: sensorId,
        moisture_level: m,
        status: status,
        timestamp: new Date().toISOString()
      });

      saveStore(store);
      return { status: status, plant: plant };
    },
    getReadings: function (plantId) {
      const store = getStore();
      if (!plantId) return store.readings || [];
      return (store.readings || []).filter(r => r.plant_id == plantId);
    },
    getAlerts: function () {
      const store = getStore();
      return store.alerts || [];
    }
  };

  // Helper to synthesize a mock JSON Response
  function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse simulated API request
  function synthesizeMockApiResponse(url, options) {
    const cleanUrl = url.toLowerCase();
    const method = (options.method || 'GET').toUpperCase();
    const store = window.PlantPulseHybridStore;

    // 1. Plants List
    if (cleanUrl.includes('/plants/list.php')) {
      return createJsonResponse({ success: true, plants: store.getPlants() });
    }

    // 2. Sensor Store Catalog
    if (cleanUrl.includes('/shop/catalog.php')) {
      return createJsonResponse({ success: true, catalog: store.getCatalog() });
    }

    // Reject mock fallback for Order and Admin Management endpoints to enforce true backend persistence
    if (cleanUrl.includes('/orders/') || cleanUrl.includes('/admin/')) {
      return createJsonResponse({
        success: false,
        error: 'BACKEND_NOT_CONFIGURED',
        message: 'Order and Admin synchronization requires an active shared backend server with database.'
      }, 503);
    }

    // 13. Simulate / Ingest Sensor (POST)
    if ((cleanUrl.includes('/sensor/simulate.php') || cleanUrl.includes('/sensor/ingest.php')) && method === 'POST') {
      try {
        const body = options.body ? JSON.parse(options.body) : {};
        const res = store.recordMoistureReading(body.plant_id, body.sensor_id, body.moisture_level);
        return createJsonResponse({ success: true, message: 'Moisture reading saved', status: res.status });
      } catch (e) {
        return createJsonResponse({ success: true, message: 'Moisture recorded' });
      }
    }

    // 14. Auth Check
    if (cleanUrl.includes('/auth/check.php')) {
      const userRaw = localStorage.getItem('pm_user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          if (user && user.id) {
            return createJsonResponse({ authenticated: true, user: user });
          }
        } catch (e) {}
      }
      return createJsonResponse({ authenticated: false, user: null });
    }

    // 15. Auth Logout
    if (cleanUrl.includes('/auth/logout.php')) {
      localStorage.removeItem('pm_user');
      localStorage.removeItem('pm_token');
      return createJsonResponse({ success: true, message: 'Logged out' });
    }

    // Generic fallback for any other api endpoint
    return createJsonResponse({ success: true });
  }

  // ------------------------------------------------------------
  // 3. OFFLINE-FIRST NATIVE BRIDGE HELPERS
  // ------------------------------------------------------------
  window.hasNativeBridge = function () {
    return Boolean(window.PlantPulseNative && typeof window.PlantPulseNative.isNativeApp === 'function');
  };

  window.isAppOnline = function () {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.isOnline === 'function') {
      return window.PlantPulseNative.isOnline();
    }
    return navigator.onLine;
  };

  window.saveReadingToNative = function (plantId, sensorId, moistureLevel, status) {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.saveMoistureReading === 'function') {
      try {
        const resStr = window.PlantPulseNative.saveMoistureReading(plantId, sensorId, moistureLevel, status);
        return JSON.parse(resStr);
      } catch (e) {
        console.error('[PlantPulse] Native save error:', e);
      }
    }
    return null;
  };

  window.getNativePlantReadings = function (plantId) {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.getPlantReadingsJson === 'function') {
      try {
        const resStr = window.PlantPulseNative.getPlantReadingsJson(plantId);
        return JSON.parse(resStr);
      } catch (e) {
        console.error('[PlantPulse] Native read error:', e);
      }
    }
    return [];
  };

  window.cacheNativePlants = function (plants) {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.cachePlants === 'function') {
      try {
        const jsonStr = typeof plants === 'string' ? plants : JSON.stringify(plants);
        window.PlantPulseNative.cachePlants(jsonStr);
      } catch (e) {}
    }
  };

  window.getCachedNativePlants = function () {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.getCachedPlants === 'function') {
      try {
        const str = window.PlantPulseNative.getCachedPlants();
        return JSON.parse(str);
      } catch (e) {}
    }
    return null;
  };

  window.getNativePendingCount = function () {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.getPendingCount === 'function') {
      return window.PlantPulseNative.getPendingCount();
    }
    return 0;
  };

  window.triggerNativeSync = function () {
    if (window.hasNativeBridge() && typeof window.PlantPulseNative.triggerSyncNow === 'function') {
      try {
        return JSON.parse(window.PlantPulseNative.triggerSyncNow());
      } catch (e) {}
    }
    return null;
  };

  // Sync stored token to native bridge
  const storedToken = localStorage.getItem('pm_token');
  if (storedToken && window.hasNativeBridge() && typeof window.PlantPulseNative.setAuthToken === 'function') {
    window.PlantPulseNative.setAuthToken(storedToken);
  }

  // ------------------------------------------------------------
  // 4. TRANSPARENT FETCH INTERCEPTOR FOR BEARER TOKEN & CLOUD FALLBACK
  // ------------------------------------------------------------
  const _nativeFetch = window.fetch;
  window.fetch = async function (resource, init) {
    let url = typeof resource === 'string' ? resource : (resource ? resource.url : '');
    const options = Object.assign({}, init);

    // If fetching an API endpoint
    const isApiCall = url.includes('/api/') || (BASE_URL && url.startsWith(BASE_URL));
    if (isApiCall) {
      const headers = new Headers(options.headers || {});

      // Auto-attach stored Auth Token
      const token = localStorage.getItem('pm_token');
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      options.headers = headers;

      // Include credentials for session cookies across domains
      if (!options.credentials) {
        options.credentials = 'include';
      }

      const isOrderOrAdminCall = url.includes('/orders/') || url.includes('/admin/');

      try {
        const res = await _nativeFetch(resource, options);
        const contentType = res.headers.get('content-type') || '';

        // If backend returned JSON (status 200, 201, 400, 401, 403, 404, 429, 500)
        if (contentType.includes('application/json')) {
          return res;
        }

        // For orders and admin management: never fabricate success or save to localStorage!
        if (isOrderOrAdminCall) {
          console.error('[PlantPulse] Shared backend returned non-JSON response from: ' + url);
          return createJsonResponse({
            success: false,
            error: 'BACKEND_NOT_CONFIGURED',
            message: 'Shared backend API unreachable. When running on GitHub Pages, configure your Cloud Backend API URL (e.g., InfinityFree or Render) to synchronize orders across devices.'
          }, 503);
        }

        // If backend returned non-JSON (e.g. raw PHP text or HTML error page), fallback for read-only
        return synthesizeMockApiResponse(url, options);
      } catch (err) {
        if (isOrderOrAdminCall) {
          console.error('[PlantPulse] Network error for Order/Admin call: ' + url, err);
          return createJsonResponse({
            success: false,
            error: 'NETWORK_FAILURE',
            message: 'Could not connect to shared backend at ' + url + '. Please check network connection and Cloud API URL setting.'
          }, 503);
        }
        // Network offline, timeout, or DNS failure -> seamless fallback
        return synthesizeMockApiResponse(url, options);
      }
    }

    return _nativeFetch(resource, options);
  };

  console.log(`[PlantPulse] Cloud API Base URL: ${BASE_URL} (Native Bridge: ${window.hasNativeBridge()})`);
})();

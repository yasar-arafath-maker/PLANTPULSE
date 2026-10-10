// ============================================================
// PlantPulse — Cloud Backend API & Native Offline Sync Bridge
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
  const DEFAULT_CLOUD_API_URL = '';

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
  // 2. OFFLINE-FIRST NATIVE BRIDGE HELPERS
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
  // 3. TRANSPARENT FETCH INTERCEPTOR FOR BEARER TOKEN & CORS
  // ------------------------------------------------------------
  const _nativeFetch = window.fetch;
  window.fetch = function (resource, init) {
    let url = typeof resource === 'string' ? resource : (resource.url || '');
    const options = Object.assign({}, init);

    // If fetching an API endpoint
    if (url.includes('/api/') || (BASE_URL && url.startsWith(BASE_URL))) {
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
    }

    return _nativeFetch(resource, options);
  };

  console.log(`[PlantPulse] Cloud API Base URL: ${BASE_URL} (Native Bridge: ${window.hasNativeBridge()})`);
})();

// ============================================================
// PlantPulse — Cloud Backend API Configuration
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
    } else {
      localStorage.removeItem('pm_cloud_api_url');
    }
    window.location.reload();
  };

  window.getCloudApiUrl = function () {
    return BASE_URL;
  };

  // ------------------------------------------------------------
  // 2. TRANSPARENT FETCH INTERCEPTOR FOR BEARER TOKEN & CORS
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

  console.log(`[PlantPulse] Cloud API Base URL configured: ${BASE_URL}`);
})();

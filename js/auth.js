// ============================================================
// auth.js — Shared Auth & Role Utilities
// ============================================================

const BASE_URL = window.BASE_URL || '/plant monitor app/api';
let currentUser = null;

// ===== Session helpers =====
function saveUser(user, token = null) {
  localStorage.setItem('pm_user', JSON.stringify(user));
  if (token) {
    localStorage.setItem('pm_token', token);
  }
  currentUser = user;
}

function getUser() {
  const raw = localStorage.getItem('pm_user');
  currentUser = raw ? JSON.parse(raw) : null;
  return currentUser;
}

function clearUser() {
  localStorage.removeItem('pm_user');
  localStorage.removeItem('pm_token');
  currentUser = null;
}

// ===== Redirect helpers =====
function redirectTo(page) {
  window.location.href = page;
}

// ===== Check auth — call on protected pages =====
let authCheckPromise = null;

async function checkAuth() {
  if (authCheckPromise) return authCheckPromise;

  authCheckPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/check.php`);
      const data = await res.json();
      if (!data.authenticated) {
        clearUser();
        redirectTo('index.html');
        return null;
      }
      saveUser(data.user);
      populateSidebarUser(data.user);
      checkAdminNav(data.user);
      return data.user;
    } catch (err) {
      console.warn('[PlantPulse Auth] Server auth check unavailable. Checking cached offline profile:', err);
      // Offline fallback: check if cached user profile exists
      const cachedUser = getUser();
      if (cachedUser && cachedUser.id) {
        cachedUser.isOfflineSession = true;
        populateSidebarUser(cachedUser);
        checkAdminNav(cachedUser);
        return cachedUser;
      }

      // No cached session: redirect to login
      clearUser();
      redirectTo('index.html');
      return null;
    } finally {
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
}

function checkAdminNav(user) {
  const adminNav = document.getElementById('nav-admin');
  if (adminNav) {
    if (user && user.role === 'admin') {
      adminNav.style.display = 'flex';
    } else {
      adminNav.style.display = 'none';
    }
  }
}

// ===== Toast notifications =====
function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== Logout =====
let isLoggingOut = false;
async function logout() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  document.querySelectorAll('#logout-btn, .logout-btn-trigger').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.5';
  });
  clearUser();
  sessionStorage.clear();
  if (window.PlantPulseNative && typeof window.PlantPulseNative.setAuthToken === 'function') {
    try { window.PlantPulseNative.setAuthToken(''); } catch (e) {}
  }
  try {
    await fetch(`${BASE_URL}/auth/logout.php`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    try { await fetch(`${BASE_URL}/auth/logout.php`, { credentials: 'include' }); } catch (e) {}
  }
  window.location.replace('index.html');
}
window.logout = logout;

// ===== Moisture helpers =====
function getMoistureColor(status) {
  return {
    critical: '#f87171',
    low:      '#fb923c',
    good:     '#3ddc6a',
    high:     '#60a5fa',
  }[status] || '#3ddc6a';
}

function getMoistureBadgeClass(status) {
  return `badge-${status || 'good'}`;
}

function getMoistureLabel(status) {
  return {
    critical: '🔴 Critically Dry',
    low:      '🟠 Needs Water',
    good:     '🟢 Healthy',
    high:     '🔵 Over-watered',
  }[status] || '— No Data';
}

function getMoistureIcon(status) {
  return {
    critical: '🔴',
    low:      '🟠',
    good:     '🟢',
    high:     '🔵',
  }[status] || '❓';
}

// ===== Gauge renderer =====
const CIRC = 339.29;

function buildGaugeSVG(pct, status) {
  const color  = getMoistureColor(status);
  const offset = CIRC - (pct / 100) * CIRC;
  return `
    <svg class="gauge-svg" viewBox="0 0 120 120">
      <circle class="gauge-bg"   cx="60" cy="60" r="54" />
      <circle class="gauge-fill" cx="60" cy="60" r="54"
        stroke="${color}"
        stroke-dasharray="${CIRC}"
        stroke-dashoffset="${offset}"
      />
    </svg>`;
}

// ===== Relative time =====
function relativeTime(dateStr) {
  if (!dateStr) return 'No reading yet';
  const now  = new Date();
  const past = new Date(dateStr);
  const diff = Math.floor((now - past) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ===== Populate user info in sidebar =====
function populateSidebarUser(user) {
  const nameEl  = document.getElementById('sidebar-user-name');
  const emailEl = document.getElementById('sidebar-user-email');
  const avatarEl= document.getElementById('sidebar-avatar');
  if (nameEl)  nameEl.textContent  = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
}

// ===== Fetch unread alert count =====
async function fetchAlertBadge() {
  try {
    const res  = await fetch(`${BASE_URL}/alerts/list.php`);
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('alert-badge');
      if (badge) {
        if (data.unread_count > 0) {
          badge.textContent = data.unread_count > 9 ? '9+' : data.unread_count;
          badge.classList.add('show');
        } else {
          badge.classList.remove('show');
        }
      }
    }
  } catch (err) {}
}

// ===== Mobile Sidebar Toggle & Accessibility =====
function setupMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  const toggleSidebar = (open) => {
    const shouldOpen = open !== undefined ? open : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', shouldOpen);
    backdrop.classList.toggle('show', shouldOpen);
    document.body.style.overflow = shouldOpen && window.innerWidth <= 768 ? 'hidden' : '';
  };

  window.toggleMobileSidebar = toggleSidebar;

  document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
    btn.setAttribute('aria-label', 'Toggle navigation menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  });

  backdrop.addEventListener('click', () => toggleSidebar(false));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleSidebar(false);
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768 && item.id !== 'logout-btn') {
        toggleSidebar(false);
      }
    });
  });
}

// ===== Android Hardware Back Button Hook (Evaluated by MainActivity.kt) =====
window.handleAndroidBackPressed = function() {
  // 1. If any modal dialog is open, dismiss it first
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) {
    openModal.classList.remove('open');
    return true;
  }
  // 2. If mobile sidebar drawer is open, close it
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('show');
    document.body.style.overflow = '';
    return true;
  }
  return false;
};

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupMobileMenu();
  document.querySelectorAll('#logout-btn, .logout-btn-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e) e.preventDefault();
      logout();
    });
  });
});

window.addEventListener('pageshow', (event) => {
  // Re-verify authentication on browser back/forward cache navigation
  const isProtectedPage = !window.location.pathname.endsWith('index.html') && 
                          !window.location.pathname.endsWith('register.html') &&
                          !window.location.pathname.endsWith('privacy-policy.html') &&
                          window.location.pathname !== '/' &&
                          !window.location.pathname.endsWith('/');
  if (isProtectedPage) {
    const user = getUser();
    if (!user || !user.id) {
      clearUser();
      redirectTo('index.html');
      return;
    }
    if (event.persisted) {
      checkAuth();
    }
  }
});


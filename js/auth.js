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
async function checkAuth() {
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
    redirectTo('index.html');
    return null;
  }
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
async function logout() {
  await fetch(`${BASE_URL}/auth/logout.php`);
  clearUser();
  redirectTo('index.html');
}

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

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('logout-btn')?.addEventListener('click', logout);
});

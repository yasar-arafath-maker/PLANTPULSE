// ============================================================
// dashboard.js — Dashboard page logic
// ============================================================

let plants = [];
let pollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  populateSidebarUser(user);
  fetchAlertBadge();

  await loadPlants();
  startPolling();

  // Network listeners for offline sync
  window.addEventListener('online', () => {
    showToast('Internet connected. Refreshing live data...', 'success');
    loadPlants(true);
  });
  window.addEventListener('offline', () => {
    showToast('Offline Mode active. Reading from local storage.', 'info');
    updateSyncStatusUI();
  });

  window.onNativeSyncCompleted = (synced, failed) => {
    if (synced > 0) {
      showToast(`☁️ Cloud Sync: ${synced} readings synced!`, 'success');
    }
    loadPlants(true);
  };
});

async function loadPlants(isBackground = false) {
  if (!isBackground && plants.length === 0) {
    showLoading(true);
  }
  try {
    const res  = await fetch(`${BASE_URL}/plants/list.php`);
    const data = await res.json();
    if (data.success) {
      plants = data.plants;
      // Cache plants locally in native SQLite for offline viewing
      if (typeof window.cacheNativePlants === 'function') {
        window.cacheNativePlants(plants);
      }
      renderStats(plants);
      renderPlants(plants);
      updateSyncStatusUI();
      return;
    }
  } catch (err) {
    console.warn('[PlantPulse] Network request failed, checking offline cache:', err);
  } finally {
    if (!isBackground || plants.length === 0) {
      showLoading(false);
    }
  }

  // Offline & Hybrid Fallback: Load from local SQLite or Universal Hybrid Store
  const fallbackPlants = (typeof window.getCachedNativePlants === 'function' && window.getCachedNativePlants())
    || (window.PlantPulseHybridStore && window.PlantPulseHybridStore.getPlants())
    || [];

  if (fallbackPlants.length > 0) {
    plants = fallbackPlants;
    renderStats(plants);
    renderPlants(plants);
    updateSyncStatusUI();
    return;
  }

  updateSyncStatusUI();
}

function updateSyncStatusUI() {
  const isOnline = typeof window.isAppOnline === 'function' ? window.isAppOnline() : navigator.onLine;
  const pendingCount = typeof window.getNativePendingCount === 'function' ? window.getNativePendingCount() : 0;
  
  let syncBadge = document.getElementById('sync-status-badge');
  if (!syncBadge) {
    const headerEl = document.querySelector('.topbar') || document.querySelector('.header') || document.querySelector('header');
    if (headerEl) {
      syncBadge = document.createElement('div');
      syncBadge.id = 'sync-status-badge';
      syncBadge.style.display = 'inline-flex';
      syncBadge.style.alignItems = 'center';
      syncBadge.style.marginRight = '12px';
      headerEl.insertBefore(syncBadge, headerEl.firstChild);
    }
  }
  
  if (syncBadge) {
    if (!isOnline) {
      syncBadge.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(251,146,60,0.15);color:#fb923c;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(251,146,60,0.3)">
          <span style="width:8px;height:8px;border-radius:50%;background:#fb923c"></span>
          Offline ${pendingCount > 0 ? `(${pendingCount} pending)` : ''}
        </span>`;
    } else if (pendingCount > 0) {
      syncBadge.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(96,165,250,0.15);color:#60a5fa;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(96,165,250,0.3);cursor:pointer" onclick="if(window.triggerNativeSync) window.triggerNativeSync();">
          <span style="width:8px;height:8px;border-radius:50%;background:#60a5fa"></span>
          Syncing (${pendingCount} pending)
        </span>`;
    } else {
      syncBadge.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(61,220,106,0.15);color:#3ddc6a;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(61,220,106,0.3)">
          <span style="width:8px;height:8px;border-radius:50%;background:#3ddc6a"></span>
          Cloud Synced
        </span>`;
    }
  }
}

function renderStats(plants) {
  const total    = plants.length;
  const critical = plants.filter(p => p.status === 'critical').length;
  const low      = plants.filter(p => p.status === 'low').length;
  const healthy  = plants.filter(p => p.status === 'good').length;

  document.getElementById('stat-total')?.textContent    !== undefined &&
    (document.getElementById('stat-total').textContent    = total);
  document.getElementById('stat-healthy')?.textContent  !== undefined &&
    (document.getElementById('stat-healthy').textContent  = healthy);
  document.getElementById('stat-low')?.textContent      !== undefined &&
    (document.getElementById('stat-low').textContent      = low);
  document.getElementById('stat-critical')?.textContent !== undefined &&
    (document.getElementById('stat-critical').textContent = critical);
}

function renderPlants(plants) {
  const grid = document.getElementById('plants-grid');
  if (!grid) return;

  if (plants.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🌱</div>
        <div class="empty-title">No plants yet</div>
        <div class="empty-text">Add your first plant to start monitoring moisture levels.</div>
        <a href="add-plant.html" class="btn btn-primary">
          <span>➕</span> Add Your First Plant
        </a>
      </div>`;
    return;
  }

  grid.innerHTML = plants.map((plant, i) => buildPlantCard(plant, i)).join('');

  // Bind delete buttons
  grid.querySelectorAll('[data-delete-plant]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDelete(btn.dataset.deletePlant, btn.dataset.plantName);
    });
  });

  // Card click → detail
  grid.querySelectorAll('.plant-card[data-plant-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      redirectTo(`plant-detail.html?id=${card.dataset.plantId}`);
    });
  });
}

function buildPlantCard(plant, index) {
  const moisture = plant.moisture_level;
  const status   = plant.status || 'no-data';
  const pct      = moisture !== null ? Math.round(moisture) : 0;
  const color    = getMoistureColor(status);
  const offset   = CIRC - (pct / 100) * CIRC;
  const badgeCls = getMoistureBadgeClass(status);
  const label    = getMoistureLabel(status);
  const lastRead = relativeTime(plant.last_reading_time);

  const gaugeHtml = moisture !== null ? `
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 120 120">
        <circle class="gauge-bg" cx="60" cy="60" r="54"/>
        <circle class="gauge-fill" cx="60" cy="60" r="54"
          stroke="${color}"
          stroke-dasharray="${CIRC}"
          stroke-dashoffset="${offset}"
          style="transition:stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1) ${index * 0.1}s"
        />
      </svg>
      <div class="gauge-center">
        <div class="gauge-pct">${pct}</div>
        <div class="gauge-unit">%</div>
      </div>
    </div>
    <div class="gauge-meta">
      <div class="gauge-status-badge ${badgeCls}">${label}</div>
      <div class="gauge-range">
        Ideal: ${plant.ideal_moisture_min}%–${plant.ideal_moisture_max}%
      </div>
      <div class="gauge-last-reading" style="margin-top:8px">🕐 ${lastRead}</div>
    </div>
  ` : `
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 120 120">
        <circle class="gauge-bg" cx="60" cy="60" r="54"/>
      </svg>
      <div class="gauge-center" style="font-size:28px">📡</div>
    </div>
    <div class="gauge-meta">
      <p class="no-reading">Waiting for<br>sensor data…</p>
    </div>
  `;

  return `
    <div class="plant-card status-${status}" data-plant-id="${plant.id}" style="animation-delay:${index * 0.07}s">
      <div class="plant-card-top">
        <div class="plant-info">
          <div class="plant-name">${plant.name}</div>
          <div class="plant-type">${plant.type}</div>
          <div class="plant-location">📍 ${plant.location}</div>
        </div>
        <div class="plant-emoji-badge">${plant.emoji}</div>
      </div>
      <div class="gauge-container">${gaugeHtml}</div>
      <div class="plant-card-actions">
        <a href="plant-detail.html?id=${plant.id}" class="btn btn-secondary btn-sm" style="flex:1">
          📊 Details
        </a>
        <button class="btn btn-danger btn-sm"
          data-delete-plant="${plant.id}"
          data-plant-name="${plant.name}">🗑</button>
      </div>
    </div>`;
}

function confirmDelete(plantId, plantName) {
  const overlay = document.getElementById('delete-modal');
  document.getElementById('delete-plant-name').textContent = plantName;
  overlay.classList.add('open');

  const confirmBtn = document.getElementById('confirm-delete-btn');
  const cancelBtn  = document.getElementById('cancel-delete-btn');

  confirmBtn.onclick = async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';
    try {
      await deletePlant(plantId);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Yes, Delete';
      overlay.classList.remove('open');
    }
  };

  cancelBtn.onclick = () => {
    overlay.classList.remove('open');
  };
}

async function deletePlant(plantId) {
  try {
    const res  = await fetch(`${BASE_URL}/plants/delete.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Plant deleted', 'success');
      await loadPlants();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Failed to delete plant', 'error');
  }
}

// ===== Alerts panel =====
async function showAlertsPanel() {
  // Handled in alerts section of dashboard
}

// ===== Polling every 30s =====
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    await loadPlants(true);
    fetchAlertBadge();
  }, 30000);
}

// ===== Loading =====
function showLoading(show) {
  const spinner = document.getElementById('loading-spinner');
  const grid    = document.getElementById('plants-grid');
  if (spinner) spinner.style.display = show ? 'block' : 'none';
  if (grid && show && plants.length === 0) grid.innerHTML = '';
}

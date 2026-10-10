// ============================================================
// plant-detail.js — Plant detail page with chart + live gauge
// ============================================================

let moistureChart = null;
let pollInterval  = null;
let plantId       = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;

  populateSidebarUser(user);
  fetchAlertBadge();

  // Get plant ID from URL
  const params = new URLSearchParams(window.location.search);
  plantId = params.get('id');
  if (!plantId) { redirectTo('dashboard.html'); return; }

  await loadDetail();
  await loadHistory();
  await loadAlerts();

  startPolling();

  document.getElementById('logout-btn')?.addEventListener('click', logout);
});

// ===== Load latest plant data =====
async function loadDetail() {
  try {
    const res  = await fetch(`${BASE_URL}/plants/list.php`);
    const data = await res.json();
    if (data.success) {
      const plant = data.plants.find(p => p.id == plantId);
      if (plant) {
        renderDetail(plant);
        return;
      }
    }
  } catch (err) {
    console.warn('[PlantPulse] Detail network error, checking cached plants:', err);
  }

  // Offline Fallback: check cached plants
  if (typeof window.getCachedNativePlants === 'function') {
    const cached = window.getCachedNativePlants();
    if (cached) {
      const plant = cached.find(p => p.id == plantId);
      if (plant) {
        renderDetail(plant);
        showToast('📡 Offline Mode: Loaded plant from local cache', 'info');
        return;
      }
    }
  }

  showToast('Failed to load plant data', 'error');
}

function renderDetail(plant) {
  const moisture = plant.moisture_level;
  const status   = plant.status || 'no-data';
  const pct      = moisture !== null ? Math.round(moisture) : 0;
  const color    = getMoistureColor(status);
  const offset   = CIRC - (pct / 100) * CIRC;

  // Plant info
  document.getElementById('plant-emoji-big').textContent = plant.emoji;
  document.getElementById('plant-name-detail').textContent = plant.name;
  document.getElementById('plant-type-detail').textContent = plant.type;
  document.getElementById('detail-location').textContent   = plant.location;
  document.getElementById('detail-min-moist').textContent  = `${plant.ideal_moisture_min}%`;
  document.getElementById('detail-max-moist').textContent  = `${plant.ideal_moisture_max}%`;
  document.getElementById('detail-sensor-id').textContent  = plant.sensor_id;
  document.getElementById('detail-last-read').textContent  = relativeTime(plant.last_reading_time);

  // Update page title
  document.title = `${plant.name} — Plant Monitor`;

  // Big gauge
  const gaugeFill = document.getElementById('big-gauge-fill');
  const gaugePct  = document.getElementById('big-gauge-pct');
  const gaugeStat = document.getElementById('big-gauge-status');

  if (gaugeFill) {
    gaugeFill.setAttribute('stroke', color);
    gaugeFill.setAttribute('stroke-dasharray', CIRC);
    gaugeFill.setAttribute('stroke-dashoffset', offset);
  }

  if (gaugePct) {
    gaugePct.textContent = moisture !== null ? `${pct}%` : '—';
    gaugePct.style.color = color;
  }

  if (gaugeStat) {
    gaugeStat.textContent = getMoistureLabel(status);
    gaugeStat.className   = `gauge-status-badge ${getMoistureBadgeClass(status)}`;
  }
}

// ===== Load history & render chart =====
async function loadHistory() {
  let combinedReadings = [];

  try {
    const res  = await fetch(`${BASE_URL}/readings/history.php?plant_id=${plantId}&limit=50`);
    const data = await res.json();
    if (data.success && Array.isArray(data.readings)) {
      combinedReadings = data.readings;
    }
  } catch (err) {
    console.warn('[PlantPulse] Failed to load server history, falling back to local storage:', err);
  }

  // Merge any pending local readings from native SQLite
  if (typeof window.getNativePlantReadings === 'function') {
    const localReadings = window.getNativePlantReadings(plantId);
    if (Array.isArray(localReadings) && localReadings.length > 0) {
      // Collect existing client_uuids to avoid duplicates
      const existingUuids = new Set(combinedReadings.map(r => r.client_uuid).filter(Boolean));
      for (const lr of localReadings) {
        if (!existingUuids.has(lr.client_uuid)) {
          combinedReadings.push({
            id: lr.server_id || null,
            client_uuid: lr.client_uuid,
            moisture_level: lr.moisture_level,
            status: lr.status,
            timestamp: new Date(lr.timestamp).toISOString(),
            is_offline_pending: lr.sync_status === 'PENDING'
          });
        }
      }
    }
  }

  // Sort chronologically for chart display
  combinedReadings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (combinedReadings.length > 0) {
    renderChart(combinedReadings);
  }
}

function renderChart(readings) {
  const ctx = document.getElementById('moisture-chart');
  if (!ctx) return;

  const labels = readings.map(r => {
    const d = new Date(r.timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const values = readings.map(r => r.moisture_level);
  const colors = readings.map(r => getMoistureColor(r.status));

  // Build gradient
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(61, 220, 106, 0.35)');
  gradient.addColorStop(1, 'rgba(61, 220, 106, 0.0)');

  if (moistureChart) {
    moistureChart.data.labels   = labels;
    moistureChart.data.datasets[0].data = values;
    moistureChart.update('none');
    return;
  }

  moistureChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Moisture (%)',
        data: values,
        borderColor: '#3ddc6a',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: colors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: readings.length > 20 ? 3 : 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0b1a0e',
          borderColor: 'rgba(61,220,106,0.4)',
          borderWidth: 1,
          titleColor: '#93b99a',
          bodyColor: '#e8f5e2',
          displayColors: false,
          callbacks: {
            label: ctx => `💧 ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#5a7a60', maxTicksLimit: 8, font: { size: 11 } },
          border: { color: 'rgba(255,255,255,0.07)' }
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#5a7a60',
            font: { size: 11 },
            callback: v => `${v}%`
          },
          border: { color: 'rgba(255,255,255,0.07)' }
        }
      },
      animation: { duration: 600, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false }
    }
  });
}

// ===== Load alerts for this plant =====
async function loadAlerts() {
  try {
    const res  = await fetch(`${BASE_URL}/alerts/list.php`);
    const data = await res.json();
    if (!data.success) return;

    // Filter alerts for this plant
    const plantAlerts = data.alerts.filter(a => {
      // Match by plant name from list
      return true; // show all alerts for now
    });

    renderAlerts(data.alerts);
  } catch (err) {}
}

function renderAlerts(alerts) {
  const list = document.getElementById('alerts-list');
  if (!list) return;

  if (alerts.length === 0) {
    list.innerHTML = `<p style="color:var(--text-3);font-size:14px;text-align:center;padding:24px">No alerts yet 🎉</p>`;
    return;
  }

  list.innerHTML = alerts.slice(0, 15).map(alert => {
    const icon = {
      critical: '🔴', low: '🟠', high: '🔵', info: '🟢'
    }[alert.alert_type] || '🔔';
    const cls = `alert-item type-${alert.alert_type} ${alert.is_read == 0 ? 'unread' : ''}`;
    return `
      <div class="${cls}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-text">${alert.message}</div>
          <div class="alert-time">${relativeTime(alert.created_at)}</div>
        </div>
      </div>`;
  }).join('');

  // Mark alerts as read
  fetch(`${BASE_URL}/alerts/mark_read.php`, { method: 'POST' });
  document.getElementById('alert-badge')?.classList.remove('show');
}

// ===== Polling =====
function startPolling() {
  pollInterval = setInterval(async () => {
    await loadDetail();
    await loadHistory();
  }, 30000);
}

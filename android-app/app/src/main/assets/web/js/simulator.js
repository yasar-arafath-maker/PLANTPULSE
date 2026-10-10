// PlantPulse — Hardware Simulator JavaScript

let userPlants = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserPlants();
  setupSimulatorControls();
});

async function loadUserPlants() {
  const select = document.getElementById('sim-plant-select');

  try {
    const res  = await fetch(`${BASE_URL}/plants/list.php`);
    const data = await res.json();

    if (data.success && data.plants && data.plants.length > 0) {
      userPlants = data.plants;
      if (typeof window.cacheNativePlants === 'function') {
        window.cacheNativePlants(userPlants);
      }
      populatePlantSelect(select, userPlants);
      return;
    }
  } catch (err) {
    console.warn('[PlantPulse] Simulator offline, checking local plant cache:', err);
  }

  // Offline Fallback
  if (typeof window.getCachedNativePlants === 'function') {
    const cached = window.getCachedNativePlants();
    if (cached && cached.length > 0) {
      userPlants = cached;
      populatePlantSelect(select, userPlants);
      showToast('📡 Offline Mode: Loaded plants from local cache', 'info');
      return;
    }
  }

  select.innerHTML = `<option value="">No registered plants found. Please connect to internet to sync plants.</option>`;
}

function populatePlantSelect(select, plants) {
  select.innerHTML = plants.map(p => `
    <option value="${p.id}" data-min="${p.ideal_moisture_min}" data-max="${p.ideal_moisture_max}">
      ${p.emoji || '🌿'} ${p.name} (${p.type}) — Sensor: ${p.sensor_id}
    </option>
  `).join('');
  onPlantSelected();
}

document.getElementById('sim-plant-select')?.addEventListener('change', onPlantSelected);

function onPlantSelected() {
  const select = document.getElementById('sim-plant-select');
  const opt    = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;

  const min = opt.getAttribute('data-min') || 40;
  const max = opt.getAttribute('data-max') || 70;

  document.getElementById('sim-min-limit').textContent = `${min}%`;
  document.getElementById('sim-max-limit').textContent = `${max}%`;
  document.getElementById('sim-calibration-info').style.display = 'block';
  updateSliderText();
}

function updateSliderText() {
  const val    = document.getElementById('sim-moisture-slider').value;
  const select = document.getElementById('sim-plant-select');
  const opt    = select.options[select.selectedIndex];
  
  document.getElementById('sim-val-display').textContent = `${val}%`;

  if (!opt) return;
  const min = parseInt(opt.getAttribute('data-min') || 40);
  const max = parseInt(opt.getAttribute('data-max') || 70);
  const statusEl = document.getElementById('sim-status-text');

  if (val <= 20) {
    statusEl.textContent = '🔴 CRITICAL DRY: Soil desperately needs water!';
    statusEl.style.color = 'var(--red)';
  } else if (val < min) {
    statusEl.textContent = `🟠 LOW MOISTURE: Below plant's ideal threshold (${min}%)`;
    statusEl.style.color = 'var(--orange)';
  } else if (val <= max) {
    statusEl.textContent = '🟢 OPTIMAL HYDRATION: Soil moisture is perfect!';
    statusEl.style.color = 'var(--green)';
  } else {
    statusEl.textContent = `🔵 HIGH MOISTURE: Above plant's ideal threshold (${max}%) - Over-watered!`;
    statusEl.style.color = 'var(--blue)';
  }
}

window.setSimValue = function(val) {
  document.getElementById('sim-moisture-slider').value = val;
  updateSliderText();
};

function setupSimulatorControls() {
  const slider = document.getElementById('sim-moisture-slider');
  slider.addEventListener('input', updateSliderText);

  document.getElementById('sim-send-btn').addEventListener('click', async () => {
    const select  = document.getElementById('sim-plant-select');
    const plantId = select.value;
    const moistVal= slider.value;
    const btn     = document.getElementById('sim-send-btn');
    const resBox  = document.getElementById('sim-result-box');
    const resTitle= document.getElementById('sim-res-title');
    const resMsg  = document.getElementById('sim-res-msg');

    if (!plantId) {
      alert('Please select a plant to simulate!');
      return;
    }

    const selectedPlant = userPlants.find(p => p.id == plantId);
    const minMoist = selectedPlant ? (selectedPlant.ideal_moisture_min || 40) : 40;
    const maxMoist = selectedPlant ? (selectedPlant.ideal_moisture_max || 70) : 70;
    const sensorId = selectedPlant ? (selectedPlant.sensor_id || `sensor_${plantId}`) : `sensor_${plantId}`;
    
    let calculatedStatus = 'good';
    if (moistVal <= 20) calculatedStatus = 'critical';
    else if (moistVal < minMoist) calculatedStatus = 'low';
    else if (moistVal > maxMoist) calculatedStatus = 'high';

    const clientUuid = 'sim_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const isOnline = typeof window.isAppOnline === 'function' ? window.isAppOnline() : navigator.onLine;

    // A. If offline or native bridge is available and user is disconnected:
    if (!isOnline && typeof window.saveReadingToNative === 'function') {
      const nativeResult = window.saveReadingToNative(parseInt(plantId), sensorId, parseFloat(moistVal), calculatedStatus);
      btn.disabled = false;
      btn.textContent = '📡 Transmit Moisture Reading';
      resBox.style.display = 'block';

      resTitle.textContent = '💾 Recorded in Local Storage (Offline Mode)';
      resTitle.style.color = 'var(--orange)';
      resMsg.innerHTML = `Moisture telemetry (<strong>${moistVal}% - ${calculatedStatus.toUpperCase()}</strong>) saved safely to Android SQLite storage.<br><br>
        <span style="color:var(--text-3);font-size:13px">
          🔄 <strong>Automatic Cloud Sync:</strong> Android background manager will automatically synchronize this reading with MySQL when connectivity returns.
        </span>`;
      showToast(`💾 Offline: Reading saved locally (${moistVal}%)`, 'info');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/sensor/simulate.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_uuid: clientUuid,
          plant_id: plantId,
          moisture_level: moistVal
        })
      });

      const data = await res.json();

      if (data.success) {
        // Also save to native local storage as already synced
        if (typeof window.saveReadingToNative === 'function') {
          window.saveReadingToNative(parseInt(plantId), sensorId, parseFloat(moistVal), calculatedStatus);
        }

        showToast(`📡 Moisture feed (${moistVal}%) sent successfully!`, 'success');
        resBox.style.display = 'block';

        if (data.alert_triggered) {
          resTitle.textContent = '🔔 Intimation Alert Triggered!';
          resTitle.style.color = 'var(--orange)';
          resMsg.innerHTML = `${data.alert_message}<br><br><a href="dashboard.html" style="color:var(--green-light); font-weight:600">View Alert in Dashboard →</a>`;
        } else {
          resTitle.textContent = '✅ Telemetry Recorded (Healthy Range)';
          resTitle.style.color = 'var(--green)';
          resMsg.textContent = `Moisture level (${moistVal}%) is within ideal parameters. No emergency alerts required.`;
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      // Fallback: If network failed unexpectedly during fetch, save to native SQLite!
      if (typeof window.saveReadingToNative === 'function') {
        window.saveReadingToNative(parseInt(plantId), sensorId, parseFloat(moistVal), calculatedStatus);
        resBox.style.display = 'block';
        resTitle.textContent = '💾 Saved Locally (Network Interrupted)';
        resTitle.style.color = 'var(--orange)';
        resMsg.innerHTML = `Connection interrupted. Reading (<strong>${moistVal}%</strong>) saved to local SQLite database and queued for cloud sync.`;
        showToast('💾 Saved offline due to network timeout', 'info');
      } else {
        alert('Connection error during simulation. Please check your internet connection.');
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '📡 Transmit Moisture Reading';
    }
  });
}

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

    if (!data.success || !data.plants || data.plants.length === 0) {
      select.innerHTML = `<option value="">No registered plants found. Please buy a sensor or add a plant first!</option>`;
      return;
    }

    userPlants = data.plants;
    select.innerHTML = userPlants.map(p => `
      <option value="${p.id}" data-min="${p.ideal_moisture_min}" data-max="${p.ideal_moisture_max}">
        ${p.emoji || '🌿'} ${p.name} (${p.type}) — Sensor: ${p.sensor_id}
      </option>
    `).join('');

    onPlantSelected();
  } catch (err) {
    select.innerHTML = `<option value="">Error loading plants.</option>`;
  }
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

    btn.disabled = true;
    btn.textContent = '⏳ Transmitting Telemetry…';
    resBox.style.display = 'none';

    try {
      const res = await fetch(`${BASE_URL}/sensor/simulate.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plant_id: plantId, moisture_level: moistVal })
      });

      const data = await res.json();

      if (data.success) {
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
      alert('Connection error during simulation.');
    } finally {
      btn.disabled = false;
      btn.textContent = '📡 Transmit Moisture Reading';
    }
  });
}

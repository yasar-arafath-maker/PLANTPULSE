// ============================================================
// add-plant.js — Add plant form logic
// ============================================================

const plantTypes = [
  { name: 'Rose',         emoji: '🌹', min: 40, max: 65 },
  { name: 'Jasmine',      emoji: '🌸', min: 45, max: 70 },
  { name: 'Tulsi',        emoji: '🌿', min: 35, max: 60 },
  { name: 'Cactus',       emoji: '🌵', min: 10, max: 30 },
  { name: 'Aloe Vera',    emoji: '🪴', min: 20, max: 40 },
  { name: 'Fern',         emoji: '🌾', min: 50, max: 75 },
  { name: 'Money Plant',  emoji: '💚', min: 40, max: 65 },
  { name: 'Orchid',       emoji: '🌺', min: 40, max: 65 },
  { name: 'Lavender',     emoji: '💜', min: 30, max: 55 },
  { name: 'Sunflower',    emoji: '🌻', min: 40, max: 65 },
];

let selectedType  = null;
let selectedEmoji = '🌿';
let generatedSensorId = '';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;
  populateSidebarUser(user);
  fetchAlertBadge();

  renderPlantTypes();
  setupRangeSliders();
  setupSensorIdGen();
  setupFormSubmit();
});

// ===== Plant type selector =====
function renderPlantTypes() {
  const grid = document.getElementById('plant-type-grid');
  if (!grid) return;

  grid.innerHTML = plantTypes.map(pt => `
    <div class="plant-type-option" data-type="${pt.name}" data-emoji="${pt.emoji}"
         data-min="${pt.min}" data-max="${pt.max}">
      <span class="type-emoji">${pt.emoji}</span>
      <span class="type-label">${pt.name}</span>
    </div>
  `).join('');

  // Custom option
  grid.innerHTML += `
    <div class="plant-type-option" data-type="Custom" data-emoji="🌱" data-min="40" data-max="65">
      <span class="type-emoji">✏️</span>
      <span class="type-label">Custom</span>
    </div>`;

  grid.querySelectorAll('.plant-type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      grid.querySelectorAll('.plant-type-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      selectedType  = opt.dataset.type;
      selectedEmoji = opt.dataset.emoji;

      // Auto-fill type input
      const typeInput = document.getElementById('plant-type-input');
      if (typeInput) typeInput.value = selectedType;

      // Auto-fill moisture sliders
      const minSlider = document.getElementById('min-moisture');
      const maxSlider = document.getElementById('max-moisture');
      if (minSlider) { minSlider.value = opt.dataset.min; updateRangeDisplay('min-moisture', 'min-val'); }
      if (maxSlider) { maxSlider.value = opt.dataset.max; updateRangeDisplay('max-moisture', 'max-val'); }
    });
  });

  // Select first by default
  grid.querySelectorAll('.plant-type-option')[0]?.click();
}

// ===== Range sliders =====
function setupRangeSliders() {
  ['min-moisture', 'max-moisture'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const dispId = id === 'min-moisture' ? 'min-val' : 'max-val';
    el.addEventListener('input', () => updateRangeDisplay(id, dispId));
    updateRangeDisplay(id, dispId);
  });
}

function updateRangeDisplay(sliderId, displayId) {
  const slider  = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (slider && display) display.textContent = slider.value + '%';
}

// ===== Sensor ID generator =====
function setupSensorIdGen() {
  const genBtn = document.getElementById('gen-sensor-btn');
  const sensorInput = document.getElementById('sensor-id-input');
  if (!genBtn || !sensorInput) return;

  genBtn.addEventListener('click', () => {
    const rand = 'SENSOR_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    sensorInput.value = rand;
    generatedSensorId = rand;
  });
}

// ===== Form submit =====
function setupFormSubmit() {
  const form = document.getElementById('add-plant-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl  = document.getElementById('form-error');
    const submitBtn = document.getElementById('submit-btn');

    const name     = document.getElementById('plant-name-input').value.trim();
    const type     = document.getElementById('plant-type-input').value.trim() || selectedType;
    const location = document.getElementById('location-input').value.trim() || 'Indoor';
    const minM     = parseInt(document.getElementById('min-moisture').value);
    const maxM     = parseInt(document.getElementById('max-moisture').value);
    const sensorId = document.getElementById('sensor-id-input').value.trim();

    if (!name || !type || !sensorId) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.classList.add('show', 'error');
      return;
    }

    if (minM >= maxM) {
      errEl.textContent = 'Min moisture must be less than max moisture.';
      errEl.classList.add('show', 'error');
      return;
    }

    errEl.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Adding plant…';

    try {
      const res  = await fetch(`${BASE_URL}/plants/add.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type, location,
          ideal_moisture_min: minM,
          ideal_moisture_max: maxM,
          sensor_id: sensorId,
          emoji: selectedEmoji
        })
      });
      const data = await res.json();

      if (data.success) {
        showApiKeyResult(data.plant);
      } else {
        errEl.textContent = data.message;
        errEl.classList.add('show', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '🌱 Add Plant';
      }
    } catch (err) {
      console.warn('[PlantPulse Add Plant] Hybrid store fallback:', err);
      if (window.PlantPulseHybridStore) {
        const apiKey = 'key_' + Math.random().toString(36).substring(2, 10);
        const newPlant = window.PlantPulseHybridStore.savePlant({
          name, type, location,
          ideal_moisture_min: minM,
          ideal_moisture_max: maxM,
          sensor_id: sensorId,
          api_key: apiKey,
          emoji: selectedEmoji
        });
        showApiKeyResult(newPlant);
        return;
      }
      errEl.textContent = 'Server error. Please try again.';
      errEl.classList.add('show', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '🌱 Add Plant';
    }
  });
}

// ===== Show API key after plant creation =====
function showApiKeyResult(plant) {
  const resultBox = document.getElementById('api-key-result');
  if (!resultBox) { redirectTo('dashboard.html'); return; }

  document.getElementById('result-sensor-id').textContent = plant.sensor_id;
  document.getElementById('result-api-key').textContent   = plant.api_key;
  document.getElementById('result-emoji').textContent     = plant.emoji;
  document.getElementById('result-name').textContent      = plant.name;

  const cleanBase = (window.BASE_URL && window.BASE_URL.startsWith('http')) 
    ? window.BASE_URL 
    : (window.location.origin.startsWith('http') ? window.location.origin + '/api' : 'https://plantpulse-backend-qhlo.onrender.com/api');
  const ingestUrl = `${cleanBase}/sensor/ingest.php`;

  // Build Universal Dual-Target ESP32 / ESP8266 C++ code snippet
  const code = `// Universal ESP32 / ESP8266 Sensor Firmware
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
  const int SENSOR_PIN = A0;
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
  const int SENSOR_PIN = 34; // Analog ADC1 Pin
#endif

const char* ssid      = "YOUR_WIFI_SSID";
const char* password  = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "${ingestUrl}";

const char* SENSOR_ID = "${plant.sensor_id}";
const char* API_KEY   = "${plant.api_key}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\n[PlantPulse] Wi-Fi Connected!");
}

void loop() {
  int rawValue = analogRead(SENSOR_PIN);
  #if defined(ESP32)
    float moisture = map(rawValue, 3200, 1200, 0, 100);
  #else
    float moisture = map(rawValue, 1023, 250, 0, 100);
  #endif
  moisture = constrain(moisture, 0, 100);

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Required for HTTPS connection to Cloud API without CA bundles

    HTTPClient http;
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\\"sensor_id\\":\\"" + String(SENSOR_ID) +
                     "\\",\\"moisture_level\\":" + String(moisture) +
                     ",\\"api_key\\":\\"" + String(API_KEY) + "\\"}";
    int httpCode = http.POST(payload);
    http.end();
  }

  delay(30000); // Send reading every 30 seconds
}`;

  document.getElementById('sensor-code').textContent = code;
  resultBox.classList.add('show');
  resultBox.scrollIntoView({ behavior: 'smooth' });

  showToast(`${plant.emoji} ${plant.name} added successfully!`, 'success');

  document.getElementById('go-dashboard-btn')?.addEventListener('click', () => {
    redirectTo('dashboard.html');
  });
}

// ===== Copy to clipboard =====
function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied!`, 'success', 2000);
  });
}

// Expose for inline onclick
window.copyToClipboard = copyToClipboard;

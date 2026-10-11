// PlantPulse — Admin Studio JavaScript

let adminOrders = [];
let currentCodingOrder = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) return;
  if (user.role !== 'admin') {
    showToast('Access denied. Administrator privileges required.', 'error');
    setTimeout(() => { redirectTo('dashboard.html'); }, 1000);
    return;
  }
  await loadAdminOrders();
  setupAdminHandlers();
});

async function loadAdminOrders() {
  const spinner   = document.getElementById('loading-spinner');
  const container = document.getElementById('admin-orders-container');

  try {
    const res  = await fetch(`${BASE_URL}/admin/orders.php`);
    const data = await res.json();
    spinner.style.display = 'none';

    if (data.success && data.orders) {
      // Update Stats
      const stats = data.stats || {};
      document.getElementById('admin-pending-coding').textContent    = stats.pending_coding || '0';
      document.getElementById('admin-coded-sensors').textContent     = stats.coded_orders || '0';
      document.getElementById('admin-dispatched-sensors').textContent = stats.dispatched_orders || '0';
      document.getElementById('admin-total-orders').textContent      = stats.total_orders || '0';

      adminOrders = data.orders || [];

      if (adminOrders.length > 0) {
        container.innerHTML = adminOrders.map(order => renderAdminOrderCard(order)).join('');
        return;
      }
    }
  } catch (err) {
    console.warn('[PlantPulse Admin] API fallback to hybrid orders queue:', err);
  }

  spinner.style.display = 'none';
  const fallbackOrders = (window.PlantPulseHybridStore && window.PlantPulseHybridStore.getOrders()) || [];
  const fallbackStats  = (window.PlantPulseHybridStore && window.PlantPulseHybridStore.getAdminStats()) || { pending_coding: 1, coded_orders: 1, dispatched_orders: 1, total_orders: 3 };

  document.getElementById('admin-pending-coding').textContent    = fallbackStats.pending_coding || '0';
  document.getElementById('admin-coded-sensors').textContent     = fallbackStats.coded_orders || '0';
  document.getElementById('admin-dispatched-sensors').textContent = fallbackStats.dispatched_orders || '0';
  document.getElementById('admin-total-orders').textContent      = fallbackStats.total_orders || '0';

  adminOrders = fallbackOrders;
  if (adminOrders.length > 0) {
    container.innerHTML = adminOrders.map(order => renderAdminOrderCard(order)).join('');
  } else {
    container.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:40px; text-align:center">
        <p style="color:var(--text-3)">No customer orders yet.</p>
      </div>`;
  }
}

function renderAdminOrderCard(order) {
  const statusMap = {
    'ordered': { label: 'Pending Admin Coding', class: 'status-ordered' },
    'coding_sensor': { label: 'Sensor Coded', class: 'status-coding_sensor' },
    'shipped': { label: 'Dispatched / Shipped', class: 'status-shipped' },
    'delivered': { label: 'Delivered', class: 'status-delivered' }
  };
  const statusInfo = statusMap[order.order_status] || statusMap['ordered'];
  const createdDate = new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:24px; animation:fadeInCard 0.3s ease both">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:12px">
        <div>
          <div style="font-size:12px; color:var(--text-3)">Order #${order.id} • ${createdDate}</div>
          <h3 style="font-family:var(--font-head); font-size:18px; font-weight:700; color:var(--text-1); margin-top:2px">
            ${order.emoji || '🌱'} ${order.plant_name} <span style="font-size:14px; color:var(--text-2)">(${order.plant_type})</span>
          </h3>
          <div style="font-size:13px; color:var(--text-2); margin-top:2px">
            Buyer: <strong>${order.user_name || order.shipping_name || 'Arun Kumar'}</strong> (${order.user_email || 'buyer@example.com'})
          </div>
        </div>
        <div style="text-align:right">
          <span class="badge-status ${statusInfo.class}">${statusInfo.label}</span>
          <div style="font-size:12px; color:var(--text-3); margin-top:4px">Package: ${order.catalog_name} (₹${parseFloat(order.price).toFixed(2)})</div>
        </div>
      </div>

      <div style="background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius); padding:14px; margin-bottom:16px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:12px">
        <div>
          <span style="color:var(--text-3); text-transform:uppercase">Assigned Sensor ID</span><br>
          <strong style="color:var(--green-light); font-family:'Courier New', monospace">${order.assigned_sensor_id || 'Not Assigned Yet'}</strong>
        </div>
        <div>
          <span style="color:var(--text-3); text-transform:uppercase">Target Moisture</span><br>
          <strong>💧 ${order.min_moisture_threshold}% - ${order.max_moisture_threshold}%</strong>
        </div>
        <div>
          <span style="color:var(--text-3); text-transform:uppercase">Delivery Address</span><br>
          <span style="color:var(--text-2)">${order.shipping_name}, ${order.shipping_address} (Ph: ${order.shipping_phone})</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
        <div style="font-size:12px; color:var(--text-3)">
          ${order.admin_notes ? `📝 Note: ${order.admin_notes}` : ''}
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-primary btn-sm" onclick="openCodingModal(${order.id})">
            💻 Code & Program Sensor
          </button>
          ${order.order_status === 'shipped' ? `
            <button class="btn btn-secondary btn-sm" onclick="updateOrderStatus(${order.id}, 'delivered')">
              ✅ Mark Delivered
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Open Sensor Coding Modal
window.openCodingModal = function(orderId) {
  const order = adminOrders.find(o => o.id === orderId);
  if (!order) return;

  currentCodingOrder = order;
  document.getElementById('code-order-id').value = order.id;
  document.getElementById('code-modal-plant-name').textContent = `${order.emoji || '🌱'} ${order.plant_name} (${order.plant_type})`;
  document.getElementById('code-modal-user-info').textContent = `Buyer: ${order.user_name} (${order.user_email})`;
  
  // Default Sensor ID
  const cleanType = (order.plant_type || 'PLANT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  document.getElementById('code-sensor-id').value = order.assigned_sensor_id || `SENS-${cleanType}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  document.getElementById('code-min-moisture').value = order.min_moisture_threshold || 40;
  document.getElementById('code-max-moisture').value = order.max_moisture_threshold || 75;
  document.getElementById('code-notes').value = order.admin_notes || `Calibrated sensor for ${order.plant_name} soil requirements.`;

  document.getElementById('arduino-code-output').style.display = 'none';
  document.getElementById('coding-error').className = 'alert-msg';
  document.getElementById('coding-modal').classList.add('open');
};

document.getElementById('close-coding-modal-btn')?.addEventListener('click', closeCodingModal);
document.getElementById('cancel-coding-btn')?.addEventListener('click', closeCodingModal);

function closeCodingModal() {
  document.getElementById('coding-modal').classList.remove('open');
}

// Handle Form Submission to Code Sensor
function setupAdminHandlers() {
  document.getElementById('coding-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl  = document.getElementById('coding-error');
    const saveBtn= document.getElementById('save-code-btn');
    if (saveBtn.disabled) return;

    const orderId    = document.getElementById('code-order-id').value;
    const sensorId   = document.getElementById('code-sensor-id').value.trim();
    const minMoist   = document.getElementById('code-min-moisture').value;
    const maxMoist   = document.getElementById('code-max-moisture').value;
    const notes      = document.getElementById('code-notes').value.trim();
    const dispatchVal= document.getElementById('code-dispatch-select').value;
    const dispatch   = (dispatchVal === 'shipped');

    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Flashing & Coding Sensor…';
    errEl.className = 'alert-msg';

    try {
      const res = await fetch(`${BASE_URL}/admin/code_sensor.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          sensor_id: sensorId,
          min_moisture: minMoist,
          max_moisture: maxMoist,
          admin_notes: notes,
          dispatch: dispatch
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast('🎉 Sensor coded & provisions saved!', 'success');
        
        // Show Arduino code
        if (data.arduino_code) {
          document.getElementById('code-block').textContent = data.arduino_code;
          document.getElementById('arduino-code-output').style.display = 'block';
        }

        saveBtn.disabled = false;
        saveBtn.textContent = '✅ Save Complete Code';
        await loadAdminOrders();
      } else {
        errEl.textContent = data.message;
        errEl.className = 'alert-msg show error';
        saveBtn.disabled = false;
        saveBtn.textContent = '⚡ Program & Code Sensor';
      }
    } catch (err) {
      console.warn('[PlantPulse Admin] Provisioning sensor via hybrid store fallback:', err);
      if (window.PlantPulseHybridStore) {
        const apiKey = 'key_' + Math.random().toString(36).substring(2, 10);
        window.PlantPulseHybridStore.codeSensor(orderId, sensorId, apiKey, minMoist, maxMoist, notes);
        if (dispatch) {
          window.PlantPulseHybridStore.updateOrderStatus(orderId, 'shipped');
        }
        showToast('🎉 Sensor coded & provisions saved!', 'success');
        document.getElementById('code-block').textContent = `// ==========================================
// PlantPulse ESP32 Firmware — Generated
// Target Sensor ID: ${sensorId}
// Calibration: Min ${minMoist}% | Max ${maxMoist}%
// ==========================================
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl= "http://192.168.1.100/api/sensor/ingest.php";
const char* sensorId = "${sensorId}";
const char* apiKey   = "${apiKey}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi Connected! Sensor Active.");
}

void loop() {
  int rawValue = analogRead(34);
  float moisture = map(rawValue, 4095, 1500, 0, 100);
  moisture = constrain(moisture, 0, 100);
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    String payload = "{\\"sensor_id\\":\\"" + String(sensorId) + "\\",\\"api_key\\":\\"" + String(apiKey) + "\\",\\"moisture_level\\":" + String(moisture) + "}";
    int httpResponseCode = http.POST(payload);
    http.end();
  }
  delay(10000);
}`;
        document.getElementById('arduino-code-output').style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = '✅ Save Complete Code';
        await loadAdminOrders();
        return;
      }
      errEl.textContent = 'Error connecting to admin API.';
      errEl.className = 'alert-msg show error';
      saveBtn.disabled = false;
      saveBtn.textContent = '⚡ Program & Code Sensor';
    }
  });

  // Copy Code snippet handler
  document.getElementById('copy-code-btn')?.addEventListener('click', () => {
    const code = document.getElementById('code-block').textContent;
    navigator.clipboard.writeText(code);
    showToast('C++ Code copied to clipboard!', 'info');
  });
}

// Update Order Status directly
let updatingStatusOrderId = null;
window.updateOrderStatus = async function(orderId, status) {
  if (updatingStatusOrderId === orderId) return;
  updatingStatusOrderId = orderId;
  try {
    const res = await fetch(`${BASE_URL}/admin/update_status.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadAdminOrders();
    } else {
      showToast(data.message || 'Status update failed', 'error');
    }
  } catch (err) {
    console.warn('[PlantPulse Admin] Update status fallback:', err);
    if (window.PlantPulseHybridStore) {
      window.PlantPulseHybridStore.updateOrderStatus(orderId, status);
      showToast('Order status updated successfully', 'success');
      await loadAdminOrders();
      return;
    }
    showToast('Network error while updating status', 'error');
  } finally {
    updatingStatusOrderId = null;
  }
};

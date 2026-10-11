// PlantPulse — Admin Studio JavaScript (Shared Server-Side Persistence)

let adminOrders = [];
let currentCodingOrder = null;
let adminPollInterval = null;

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

  // Sensible polling: Refresh admin orders queue every 15 seconds for cross-device sync
  if (!adminPollInterval) {
    adminPollInterval = setInterval(() => {
      // Avoid refreshing while coding modal is actively open
      const codingModal = document.getElementById('coding-modal');
      if (!codingModal || !codingModal.classList.contains('open')) {
        loadAdminOrders(true); // silent refresh
      }
    }, 15000);
  }
});

window.addEventListener('beforeunload', () => {
  if (adminPollInterval) {
    clearInterval(adminPollInterval);
    adminPollInterval = null;
  }
});

async function loadAdminOrders(isSilent = false) {
  const spinner   = document.getElementById('loading-spinner');
  const container = document.getElementById('admin-orders-container');

  if (!isSilent && spinner) {
    spinner.style.display = 'block';
  }

  try {
    const res  = await fetch(`${BASE_URL}/admin/orders.php`);
    const data = await res.json();
    if (spinner) spinner.style.display = 'none';

    if (res.status === 401) {
      clearUser();
      redirectTo('index.html');
      return;
    }

    if (res.status === 403) {
      showToast('Access denied. Administrator privileges required.', 'error');
      setTimeout(() => { redirectTo('dashboard.html'); }, 1200);
      return;
    }

    if (data.success && data.orders) {
      // Update Live Stats
      const stats = data.stats || {};
      document.getElementById('admin-pending-coding').textContent    = stats.pending_coding || '0';
      document.getElementById('admin-coded-sensors').textContent     = stats.coded_orders || '0';
      document.getElementById('admin-dispatched-sensors').textContent = stats.dispatched_orders || '0';
      document.getElementById('admin-total-orders').textContent      = stats.total_orders || '0';

      adminOrders = data.orders || [];

      if (adminOrders.length > 0) {
        container.innerHTML = adminOrders.map(order => renderAdminOrderCard(order)).join('');
      } else {
        container.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:48px 24px; text-align:center">
            <div style="font-size:40px; margin-bottom:12px">📦</div>
            <h3 style="font-family:var(--font-head); font-size:18px; font-weight:700; color:var(--text-1); margin-bottom:6px">No Customer Orders in Database</h3>
            <p style="color:var(--text-3); font-size:13px; max-width:440px; margin:0 auto">When a customer places a sensor order from any device, it will automatically appear here in real-time.</p>
          </div>`;
      }
      return;
    }

    // Backend returned error
    if (!isSilent) {
      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:40px 24px; text-align:center">
          <div style="font-size:36px; margin-bottom:8px">⚠️</div>
          <h4 style="color:var(--text-1); margin-bottom:6px; font-family:var(--font-head)">Unable to Load Orders from Cloud Database</h4>
          <p style="color:var(--text-3); font-size:13px; margin-bottom:16px">${data.message || 'Server returned an error'}</p>
          <button class="btn btn-secondary btn-sm" onclick="loadAdminOrders()">🔄 Retry</button>
        </div>`;
    }
  } catch (err) {
    console.error('[PlantPulse Admin] Error loading live orders:', err);
    if (spinner) spinner.style.display = 'none';
    if (!isSilent) {
      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:40px 24px; text-align:center">
          <div style="font-size:36px; margin-bottom:8px">🔌</div>
          <h4 style="color:var(--text-1); margin-bottom:6px; font-family:var(--font-head)">Cannot Connect to Shared Backend</h4>
          <p style="color:var(--text-3); font-size:13px; margin-bottom:8px">${err.message || 'Network connection failed'}</p>
          <p style="color:var(--text-3); font-size:12px; margin-bottom:16px">When running on GitHub Pages, configure your Cloud Backend API URL (e.g., InfinityFree or Render) to synchronize data across devices.</p>
          <button class="btn btn-secondary btn-sm" onclick="loadAdminOrders()">🔄 Retry Connection</button>
        </div>`;
    }
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
            Buyer: <strong>${order.user_name || order.shipping_name || 'Customer'}</strong> (${order.user_email || 'customer@plantpulse.app'})
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
  document.getElementById('code-modal-user-info').textContent = `Buyer: ${order.user_name || order.shipping_name}${order.user_email ? ' (' + order.user_email + ')' : ''}`;
  
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
        showToast('🎉 Sensor coded & provisions saved to database!', 'success');
        
        // Show Arduino code
        if (data.arduino_code) {
          document.getElementById('code-block').textContent = data.arduino_code;
          document.getElementById('arduino-code-output').style.display = 'block';
        }

        saveBtn.disabled = false;
        saveBtn.textContent = '✅ Save Complete Code';
        await loadAdminOrders();
      } else {
        errEl.textContent = data.message || 'Sensor coding failed on server.';
        errEl.className = 'alert-msg show error';
        saveBtn.disabled = false;
        saveBtn.textContent = '⚡ Program & Code Sensor';
      }
    } catch (err) {
      console.error('[PlantPulse Admin] Error submitting sensor code:', err);
      errEl.textContent = 'Failed to connect to shared backend: ' + (err.message || 'Network error');
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

  // Cloud API Configuration Handler
  const cloudBtn = document.getElementById('admin-cloud-config-btn');
  const cloudLabel = document.getElementById('admin-api-status-label');
  if (cloudLabel) {
    try {
      const urlObj = new URL(BASE_URL, window.location.origin);
      cloudLabel.textContent = urlObj.host || 'Cloud API';
    } catch (e) {
      cloudLabel.textContent = 'Cloud API';
    }
  }
  cloudBtn?.addEventListener('click', () => {
    const current = localStorage.getItem('pm_cloud_api_url') || BASE_URL;
    const input = prompt(
      "Enter your shared Cloud Backend API URL:\n(e.g. https://plantpulse.free.nf/api or https://plantpulse.onrender.com/api)\nLeave empty to reset to auto-detect:",
      current
    );
    if (input !== null) {
      window.setCloudApiUrl(input.trim());
    }
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
      showToast(data.message || 'Status update failed on server', 'error');
    }
  } catch (err) {
    console.error('[PlantPulse Admin] Update status error:', err);
    showToast('Network error while updating order status on shared database', 'error');
  } finally {
    updatingStatusOrderId = null;
  }
};

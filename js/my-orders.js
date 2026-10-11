// PlantPulse — My Orders JavaScript (Shared Server-Side Persistence)

let userOrdersPollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserOrders();

  // Sensible polling: check order status updates from Admin every 20 seconds
  if (!userOrdersPollInterval) {
    userOrdersPollInterval = setInterval(() => {
      loadUserOrders(true); // silent background refresh
    }, 20000);
  }
});

window.addEventListener('beforeunload', () => {
  if (userOrdersPollInterval) {
    clearInterval(userOrdersPollInterval);
    userOrdersPollInterval = null;
  }
});

async function loadUserOrders(isSilent = false) {
  const spinner = document.getElementById('loading-spinner');
  const container = document.getElementById('orders-list');

  if (!isSilent && spinner) {
    spinner.style.display = 'block';
  }

  try {
    const res  = await fetch(`${BASE_URL}/orders/list.php`);
    const data = await res.json();
    if (spinner) spinner.style.display = 'none';

    if (res.status === 401) {
      clearUser();
      redirectTo('index.html');
      return;
    }

    if (data.success && data.orders) {
      if (data.orders.length > 0) {
        container.innerHTML = data.orders.map(order => renderOrderCard(order)).join('');
      } else {
        container.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:48px 24px; text-align:center">
            <div style="font-size:48px; margin-bottom:12px">📦</div>
            <h3 style="font-family:var(--font-head); font-size:20px; font-weight:700; margin-bottom:8px">No Sensor Orders Yet</h3>
            <p style="color:var(--text-2); font-size:14px; margin-bottom:20px">Purchase a custom-coded sensor kit for your Rose, Jasmine, or other plants.</p>
            <a href="shop.html" class="btn btn-primary">🛒 Visit Sensor Store</a>
          </div>`;
      }
      return;
    }

    if (!isSilent) {
      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:40px 24px; text-align:center">
          <div style="font-size:36px; margin-bottom:8px">⚠️</div>
          <h4 style="color:var(--text-1); margin-bottom:6px">Failed to Load Orders from Server</h4>
          <p style="color:var(--text-3); font-size:13px; margin-bottom:16px">${data.message || 'Unable to retrieve orders from cloud database'}</p>
          <button class="btn btn-secondary btn-sm" onclick="loadUserOrders()">🔄 Retry</button>
        </div>`;
    }
  } catch (err) {
    console.error('[PlantPulse Orders] Error fetching user orders:', err);
    if (spinner) spinner.style.display = 'none';
    if (!isSilent) {
      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:40px 24px; text-align:center">
          <div style="font-size:36px; margin-bottom:8px">🔌</div>
          <h4 style="color:var(--text-1); margin-bottom:6px">Cannot Connect to Shared Server</h4>
          <p style="color:var(--text-3); font-size:13px; margin-bottom:16px">${err.message || 'Connection failed'}</p>
          <button class="btn btn-secondary btn-sm" onclick="loadUserOrders()">🔄 Retry</button>
        </div>`;
    }
  }
}

function renderOrderCard(order) {
  const statusMap = {
    'ordered': { label: 'Order Placed', step: 1, class: 'status-ordered' },
    'coding_sensor': { label: 'Admin Coding Sensor', step: 2, class: 'status-coding_sensor' },
    'shipped': { label: 'Sensor Shipped', step: 3, class: 'status-shipped' },
    'delivered': { label: 'Delivered & Connected', step: 4, class: 'status-delivered' }
  };

  const currentStatus = statusMap[order.order_status] || statusMap['ordered'];
  const createdDate   = new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); padding:28px; animation:fadeInCard 0.3s ease both">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px">
        <div>
          <div style="font-size:12px; color:var(--text-3); font-weight:600; text-transform:uppercase">Order #${order.id} • ${createdDate}</div>
          <h3 style="font-family:var(--font-head); font-size:20px; font-weight:700; color:var(--text-1); margin-top:4px">
            ${order.emoji || '🌱'} ${order.plant_name} (${order.plant_type})
          </h3>
          <div style="font-size:13px; color:var(--text-2)">Sensor Kit: ${order.catalog_name}</div>
        </div>
        <div style="text-align:right">
          <span class="badge-status ${currentStatus.class}">${currentStatus.label}</span>
          <div style="font-family:var(--font-head); font-size:18px; font-weight:800; color:var(--green); margin-top:6px">₹${parseFloat(order.price).toFixed(2)}</div>
        </div>
      </div>

      <!-- Stepper -->
      <div class="stepper-wrap">
        <div class="stepper-step ${currentStatus.step >= 1 ? 'active' : ''}">
          <div class="stepper-circle">1</div>
          <div class="stepper-label">Order Placed</div>
        </div>
        <div class="stepper-step ${currentStatus.step >= 2 ? 'active' : ''}">
          <div class="stepper-circle">2</div>
          <div class="stepper-label">Admin Coding</div>
        </div>
        <div class="stepper-step ${currentStatus.step >= 3 ? 'active' : ''}">
          <div class="stepper-circle">3</div>
          <div class="stepper-label">Shipped</div>
        </div>
        <div class="stepper-step ${currentStatus.step >= 4 ? 'active' : ''}">
          <div class="stepper-circle">4</div>
          <div class="stepper-label">Delivered</div>
        </div>
      </div>

      <!-- Sensor Info Box -->
      <div style="background:var(--bg-2); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-top:16px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px">
        <div>
          <div style="font-size:11px; color:var(--text-3); text-transform:uppercase">Assigned Sensor Hardware ID</div>
          <div style="font-family:'Courier New', monospace; font-size:14px; font-weight:700; color:${order.assigned_sensor_id ? 'var(--green-light)' : 'var(--text-3)'}">
            ${order.assigned_sensor_id || '⏳ Pending Admin Programming'}
          </div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-3); text-transform:uppercase">Coded Basis Moisture Range</div>
          <div style="font-size:14px; font-weight:600; color:var(--text-1)">
            💧 ${order.min_moisture_threshold}% - ${order.max_moisture_threshold}%
          </div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-3); text-transform:uppercase">Shipping Address</div>
          <div style="font-size:13px; color:var(--text-2)">
            ${order.shipping_name}, ${order.shipping_address}
          </div>
        </div>
      </div>

      ${order.assigned_sensor_id ? `
        <div style="margin-top:16px; text-align:right">
          <a href="dashboard.html" class="btn btn-secondary btn-sm">📊 View Plant in Dashboard</a>
          <a href="simulator.html" class="btn btn-primary btn-sm" style="margin-left:8px">⚡ Test Feed in Simulator</a>
        </div>
      ` : ''}
    </div>
  `;
}

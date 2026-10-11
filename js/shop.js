// PlantPulse — Shop & Payment JavaScript (Indian Rupees ₹ & Plant Recommender)

let catalogItems = [];
let selectedPaymentMethod = 'UPI / GPay / PhonePe';
let currentCategory = 'All';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCatalog();
  setupPaymentMethodSelector();
  setupFormHandlers();
});

// Load Sensor Catalog from API
async function loadCatalog() {
  const spinner = document.getElementById('loading-spinner');
  const grid    = document.getElementById('shop-grid');

  try {
    const res  = await fetch(`${BASE_URL}/shop/catalog.php`);
    const data = await res.json();
    spinner.style.display = 'none';

    if (data.success && data.catalog && data.catalog.length > 0) {
      catalogItems = data.catalog;
      renderCatalogGrid(catalogItems);
      return;
    }
  } catch (err) {
    console.warn('[PlantPulse Shop] API fetch fallback to hybrid catalog:', err);
  }

  spinner.style.display = 'none';
  const fallbackCatalog = (window.PlantPulseHybridStore && window.PlantPulseHybridStore.getCatalog()) || [];
  if (fallbackCatalog.length > 0) {
    catalogItems = fallbackCatalog;
    renderCatalogGrid(catalogItems);
  } else {
    grid.innerHTML = `<p style="color:var(--text-3); text-align:center; width:100%; grid-column:1/-1">No sensor kits available right now.</p>`;
  }
}

// Render catalog items matching selected plant category
function renderCatalogGrid(items) {
  const grid = document.getElementById('shop-grid');
  
  const filtered = currentCategory === 'All' 
    ? items 
    : items.filter(item => item.plant_type.toLowerCase() === currentCategory.toLowerCase());

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-3); text-align:center; width:100%; grid-column:1/-1">No specific sensor found for this category. Check our Universal Smart Sensor!</p>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="shop-card">
      <div>
        <div class="shop-card-top">
          <div class="shop-card-emoji">${item.emoji || '🌱'}</div>
          <div>
            <div class="shop-card-title">${item.name}</div>
            <div class="shop-card-plant">Target: ${item.plant_type} Plant</div>
          </div>
        </div>
        <div class="shop-card-desc">${item.description}</div>
        <div style="font-size:12px; color:var(--text-3); margin-bottom:12px">
          💧 Coded Moisture Range: <strong>${item.default_min_moisture}% - ${item.default_max_moisture}%</strong>
        </div>
      </div>
      <div class="shop-card-meta">
        <div class="shop-price">₹${parseFloat(item.price).toFixed(2)}</div>
        <button class="btn btn-primary btn-sm" onclick="openCheckoutModal(${item.id})">
          🛒 Buy & Code Sensor
        </button>
      </div>
    </div>
  `).join('');
}

// Filter catalog by plant category
window.filterCatalog = function(category, btnEl) {
  currentCategory = category;
  
  // Highlight active tab
  document.querySelectorAll('#plant-filter-bar button').forEach(b => b.classList.remove('active-filter'));
  if (btnEl) btnEl.classList.add('active-filter');

  renderCatalogGrid(catalogItems);
};

// Open Payment Checkout Modal
window.openCheckoutModal = function(catalogId) {
  const item = catalogItems.find(i => i.id === catalogId);
  if (!item) return;

  document.getElementById('modal-catalog-id').value = item.id;
  document.getElementById('plant-type').value = item.plant_type;
  document.getElementById('plant-name').value = `My ${item.plant_type}`;
  
  // Pre-fill user details if logged in
  const user = currentUser || (typeof getUser === 'function' ? getUser() : null);
  if (user) {
    const nameInput = document.getElementById('shipping-name');
    if (nameInput && !nameInput.value) {
      nameInput.value = user.name || '';
    }
  }

  document.getElementById('summary-price').textContent = `₹${parseFloat(item.price).toFixed(2)}`;
  document.getElementById('summary-total').textContent = `₹${parseFloat(item.price).toFixed(2)}`;

  document.getElementById('checkout-error').className = 'alert-msg';
  document.getElementById('checkout-modal').classList.add('open');
};

// Close Modal
document.getElementById('close-modal-btn')?.addEventListener('click', closeCheckoutModal);
document.getElementById('cancel-checkout-btn')?.addEventListener('click', closeCheckoutModal);

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('open');
}

// Payment method selector logic (Indian Payment Options)
function setupPaymentMethodSelector() {
  const opts = document.querySelectorAll('.payment-opt');
  const inputFields = document.getElementById('payment-input-fields');

  opts.forEach(opt => {
    opt.addEventListener('click', () => {
      opts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedPaymentMethod = opt.getAttribute('data-method');

      // Update dynamic input fields based on Indian payment method
      if (selectedPaymentMethod.includes('UPI')) {
        inputFields.innerHTML = `
          <div class="form-group">
            <input type="text" id="payment-extra-input" class="form-control" placeholder="Enter UPI ID: user@okaxis / user@ybl / phonepe" value="buyer@gpay" />
          </div>`;
      } else if (selectedPaymentMethod.includes('Card')) {
        inputFields.innerHTML = `
          <div class="form-group">
            <input type="text" class="form-control" placeholder="Card Number: 4532 •••• •••• 8821" value="4532 8912 3456 8821" />
          </div>
          <div class="form-row">
            <input type="text" class="form-control" placeholder="MM/YY" value="12/28" />
            <input type="password" class="form-control" placeholder="CVV" value="882" />
          </div>`;
      } else if (selectedPaymentMethod.includes('Net')) {
        inputFields.innerHTML = `
          <div class="form-group">
            <select class="form-control">
              <option>State Bank of India (SBI)</option>
              <option>HDFC Bank</option>
              <option>ICICI Bank</option>
              <option>Axis Bank</option>
            </select>
          </div>`;
      } else {
        inputFields.innerHTML = `
          <div style="font-size:13px; color:var(--green-light); padding:10px; background:var(--bg-2); border-radius:var(--radius); border:1px solid var(--border)">
            💵 Cash on Delivery Selected: Pay ₹${document.getElementById('summary-total').textContent.replace('₹','')} upon delivery to courier agent.
          </div>`;
      }
    });
  });
}

// Setup form submit handler
function setupFormHandlers() {
  document.getElementById('checkout-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl  = document.getElementById('checkout-error');
    const payBtn = document.getElementById('pay-btn');

    if (payBtn.disabled) return;

    const catalogId       = document.getElementById('modal-catalog-id').value;
    const plantName       = document.getElementById('plant-name').value.trim();
    const plantType       = document.getElementById('plant-type').value.trim();
    const shippingName    = document.getElementById('shipping-name').value.trim();
    const shippingPhone   = document.getElementById('shipping-phone').value.trim();
    const shippingAddress = document.getElementById('shipping-address').value.trim();

    if (!plantName || !plantType || !shippingName || !shippingPhone || !shippingAddress) {
      errEl.textContent = 'Please fill out all plant and shipping details.';
      errEl.className = 'alert-msg show error';
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = '⏳ Processing Payment & Placing Order…';
    errEl.className = 'alert-msg';

    try {
      const res = await fetch(`${BASE_URL}/orders/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog_id: catalogId,
          plant_name: plantName,
          plant_type: plantType,
          shipping_name: shippingName,
          shipping_phone: shippingPhone,
          shipping_address: shippingAddress,
          payment_method: selectedPaymentMethod
        })
      });

      const data = await res.json();

      if (data.success) {
        showToast('🎉 Payment successful! Sensor order placed.', 'success');
        closeCheckoutModal();
        setTimeout(() => {
          window.location.href = 'my-orders.html';
        }, 1200);
      } else {
        errEl.textContent = data.message || 'Failed to persist order to shared database.';
        errEl.className = 'alert-msg show error';
        payBtn.disabled = false;
        payBtn.textContent = '🔒 Pay & Place Sensor Order';
      }
    } catch (err) {
      console.error('[PlantPulse Shop] Order placement network/server failure:', err);
      errEl.textContent = 'Could not save order to shared database: ' + (err.message || 'Connection failed. Verify cloud backend is online.');
      errEl.className = 'alert-msg show error';
      payBtn.disabled = false;
      payBtn.textContent = '🔒 Pay & Place Sensor Order';
    }
  });
}

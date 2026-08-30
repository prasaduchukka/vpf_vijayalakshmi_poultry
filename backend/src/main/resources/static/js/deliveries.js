async function loadDeliveriesPage() {
  try {
    const customers = await Api.get('/api/customers');
    const options = customers.map(c => `<option value="${c.id}">${escapeHtml(c.chickenCenterName)}</option>`).join('');
    document.getElementById('d-customer').innerHTML = options;
    document.getElementById('p-customer').innerHTML = options;
    await refreshDeliveries();
  } catch (err) {
    handleError(err);
  }
}

async function refreshDeliveries() {
  const from = document.getElementById('from-filter').value;
  const to = document.getElementById('to-filter').value;
  let url = '/api/deliveries';
  if (from && to) url += `?from=${from}&to=${to}`;
  try {
    const list = await Api.get(url);
    renderDeliveries(list);
  } catch (err) {
    handleError(err);
  }
}

function renderDeliveries(list) {
  const admin = isAdmin();
  const body = document.getElementById('deliveries-body');
  body.innerHTML = list.length ? list.map(d => `
    <tr>
      <td>${fmtDate(d.deliveryDate)}</td>
      <td><a href="customer-detail.html?id=${d.customerId}">${escapeHtml(d.customerName)}</a></td>
      <td>${d.numberOfBirds ?? '-'}</td>
      <td>${fmtKg(d.dispatchWeight)}</td>
      <td>${fmtMoney(d.sellingRate)}</td>
      <td class="text-right mono">${fmtMoney(d.salesAmount)}</td>
      <td>${admin ? `<button class="btn-danger btn-sm" onclick="deleteDelivery(${d.id})">Delete</button>` : ''}</td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="table-empty">No deliveries found for this period</td></tr>';

  const total = list.reduce((sum, d) => sum + Number(d.salesAmount), 0);
  const totalLine = document.getElementById('total-line');
  if (list.length) {
    totalLine.style.display = 'flex';
    totalLine.innerHTML = `<span>Total Sales</span><span class="mono">${fmtMoney(total)}</span>`;
  } else {
    totalLine.style.display = 'none';
  }
}

async function deleteDelivery(id) {
  if (!confirm("Permanently delete this delivery? This will also update the customer's ledger balance. This cannot be undone.")) return;
  try {
    await Api.del(`/api/deliveries/${id}`);
    showToast('Delivery deleted');
    await refreshDeliveries();
  } catch (err) {
    handleError(err);
  }
}

function recalcDeliveryPreview() {
  const dispatch = Number(document.getElementById('d-dispatch').value || 0);
  const rate = Number(document.getElementById('d-rate').value || 0);
  document.getElementById('d-sales-amount').value = '\u20b9 ' + (dispatch * rate).toFixed(2);
}
['d-dispatch', 'd-rate'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcDeliveryPreview));

let deliverySession = []; // running list of deliveries saved this modal session (Save & Next)

function renderDeliverySession() {
  const box = document.getElementById('delivery-session-list');
  if (!deliverySession.length) { box.innerHTML = ''; return; }
  const total = deliverySession.reduce((s, d) => s + d.amount, 0);
  box.innerHTML = `
    <div class="card" style="background:var(--green-100); border-color:#cfe3d4; padding:10px 14px; margin-bottom:14px;">
      <div style="font-size:12.5px; font-weight:700; color:var(--green-800); margin-bottom:6px;">
        Recorded this session (${deliverySession.length})
      </div>
      ${deliverySession.map(d => `<div class="summary-line"><span>${escapeHtml(d.customerName)}</span><span class="mono">${fmtMoney(d.amount)}</span></div>`).join('')}
      <div class="summary-line total"><span>Total</span><span class="mono">${fmtMoney(total)}</span></div>
    </div>
  `;
}

document.getElementById('add-delivery-btn').addEventListener('click', () => {
  deliverySession = [];
  renderDeliverySession();
  document.getElementById('delivery-form').reset();
  document.getElementById('d-date').value = todayIso();
  document.getElementById('d-sales-amount').value = '';
  document.getElementById('delivery-form-error').innerHTML = '';
  openModal('delivery-modal');
});

async function saveCurrentDelivery() {
  const customerSelect = document.getElementById('d-customer');
  const payload = {
    customerId: Number(customerSelect.value),
    deliveryDate: document.getElementById('d-date').value,
    numberOfBirds: document.getElementById('d-birds').value ? Number(document.getElementById('d-birds').value) : null,
    dispatchWeight: Number(document.getElementById('d-dispatch').value),
    sellingRate: Number(document.getElementById('d-rate').value),
    notes: document.getElementById('d-notes').value.trim(),
    createdBy: 'admin',
  };
  const saved = await Api.post('/api/deliveries', payload);
  deliverySession.push({ customerName: customerSelect.options[customerSelect.selectedIndex].text, amount: saved.salesAmount });
  return saved;
}

// Save & Next: keep the modal open, clear the entry fields, move to the next delivery.
document.getElementById('delivery-save-next-btn').addEventListener('click', async () => {
  const errorBox = document.getElementById('delivery-form-error');
  errorBox.innerHTML = '';
  const btn = document.getElementById('delivery-save-next-btn');
  btn.disabled = true;
  try {
    await saveCurrentDelivery();
    renderDeliverySession();
    showToast('Delivery saved \u2014 ready for the next one');
    document.getElementById('d-birds').value = '';
    document.getElementById('d-dispatch').value = '';
    document.getElementById('d-rate').value = '';
    document.getElementById('d-sales-amount').value = '';
    document.getElementById('d-notes').value = '';
    document.getElementById('d-customer').focus();
  } catch (err) {
    errorBox.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

// Save & Finish: save the current entry and close, refreshing the list.
document.getElementById('delivery-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('delivery-form-error');
  errorBox.innerHTML = '';
  const btn = document.getElementById('delivery-save-btn');
  btn.disabled = true;
  try {
    await saveCurrentDelivery();
    showToast(`${deliverySession.length} deliver${deliverySession.length > 1 ? 'ies' : 'y'} recorded`);
    closeModal('delivery-modal');
    await refreshDeliveries();
  } catch (err) {
    errorBox.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('add-payment-btn').addEventListener('click', () => {
  document.getElementById('payment-form').reset();
  document.getElementById('p-date').value = todayIso();
  document.getElementById('payment-form-error').innerHTML = '';
  openModal('payment-modal');
});

document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    customerId: Number(document.getElementById('p-customer').value),
    paymentDate: document.getElementById('p-date').value,
    amount: Number(document.getElementById('p-amount').value),
    paymentMethod: document.getElementById('p-method').value,
    referenceNumber: document.getElementById('p-reference').value.trim(),
    notes: document.getElementById('p-notes').value.trim(),
    createdBy: 'admin',
  };
  const btn = document.getElementById('payment-save-btn');
  btn.disabled = true;
  try {
    await Api.post('/api/customer-payments', payload);
    showToast('Payment recorded');
    closeModal('payment-modal');
  } catch (err) {
    document.getElementById('payment-form-error').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('apply-filter-btn').addEventListener('click', refreshDeliveries);

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadDeliveriesPage, 50);
});

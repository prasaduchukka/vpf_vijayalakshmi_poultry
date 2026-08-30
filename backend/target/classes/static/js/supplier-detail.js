const supplierId = new URLSearchParams(location.search).get('id');

async function loadSupplierDetail() {
  if (!supplierId) {
    document.getElementById('supplier-header-card').innerHTML = '<div class="alert alert-error">No supplier specified.</div>';
    return;
  }
  try {
    const [summary, purchases, payments, ledger] = await Promise.all([
      Api.get(`/api/suppliers/${supplierId}/account`),
      Api.get(`/api/purchases?supplierId=${supplierId}`),
      Api.get(`/api/supplier-payments?supplierId=${supplierId}`),
      Api.get(`/api/supplier-ledger/${supplierId}`),
    ]);
    renderHeader(summary);
    renderStats(summary);
    renderPurchases(purchases);
    renderPayments(payments);
    renderLedger(ledger);
  } catch (err) {
    handleError(err);
  }
}

function renderHeader(summary) {
  const s = summary.supplier;
  document.title = s.supplierName + ' \u2013 Vijayalakshmi Poultry Farm';
  document.getElementById('supplier-header-card').innerHTML = `
    <div class="card-title-row">
      <div>
        <h2 style="margin-bottom:4px;">${escapeHtml(s.supplierName)}</h2>
        <div class="text-muted">${escapeHtml(s.contactPerson || '')} ${s.phoneNumber ? '\u00b7 ' + escapeHtml(s.phoneNumber) : ''}</div>
        <div class="text-muted">${escapeHtml(s.address || '')}</div>
      </div>
      ${statusBadge(s.status)}
    </div>
  `;
}

function renderStats(summary) {
  const outstanding = Number(summary.currentOutstandingPayable);
  document.getElementById('supplier-stats').innerHTML = `
    <div class="stat-card ${outstanding > 0 ? 'amber' : ''}">
      <div class="stat-label">Current Outstanding Payable</div>
      <div class="stat-value">${fmtMoney(summary.currentOutstandingPayable)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Purchased</div>
      <div class="stat-value">${fmtMoney(summary.totalPurchased)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Paid</div>
      <div class="stat-value">${fmtMoney(summary.totalPaid)}</div>
    </div>
  `;
}

function renderPurchases(list) {
  const admin = isAdmin();
  const body = document.getElementById('purchases-body');
  body.innerHTML = list.length ? list.map(p => `
    <tr>
      <td>${fmtDate(p.purchaseDate)}</td>
      <td>${p.numberOfBirds ?? '-'}</td>
      <td>${p.numberOfBoxes ?? '-'}</td>
      <td>${fmtKg(p.purchaseWeight)}</td>
      <td>${fmtMoney(p.purchaseRate)}</td>
      <td class="text-right mono">${fmtMoney(p.purchaseAmount)}</td>
      <td>${admin ? `<button class="btn-danger btn-sm" onclick="deletePurchase(${p.id})">Delete</button>` : ''}</td>
    </tr>
  `).join('') : '<tr><td colspan="7" class="table-empty">No purchases recorded yet</td></tr>';
}

async function deletePurchase(id) {
  if (!confirm("Permanently delete this purchase? This updates the supplier's ledger balance. This cannot be undone.")) return;
  try {
    await Api.del(`/api/purchases/${id}`);
    showToast('Purchase deleted');
    await loadSupplierDetail();
  } catch (err) { handleError(err); }
}

function renderPayments(list) {
  const admin = isAdmin();
  const body = document.getElementById('payments-body');
  body.innerHTML = list.length ? list.map(p => `
    <tr>
      <td>${fmtDate(p.paymentDate)}</td>
      <td>${p.paymentMethod}</td>
      <td>${escapeHtml(p.referenceNumber || '-')}</td>
      <td class="text-right mono">${fmtMoney(p.amount)}</td>
      <td>${admin ? `<button class="btn-danger btn-sm" onclick="deleteSupplierPaymentRow(${p.id})">Delete</button>` : ''}</td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="table-empty">No payments recorded yet</td></tr>';
}

async function deleteSupplierPaymentRow(id) {
  if (!confirm("Permanently delete this payment? This updates the supplier's ledger balance. This cannot be undone.")) return;
  try {
    await Api.del(`/api/supplier-payments/${id}`);
    showToast('Payment deleted');
    await loadSupplierDetail();
  } catch (err) { handleError(err); }
}

function renderLedger(list) {
  const body = document.getElementById('ledger-body');
  body.innerHTML = list.length ? list.map(e => `
    <tr>
      <td>${fmtDate(e.entryDate)}</td>
      <td>${e.referenceType}</td>
      <td class="text-right mono">${Number(e.debit) > 0 ? fmtMoney(e.debit) : '-'}</td>
      <td class="text-right mono">${Number(e.credit) > 0 ? fmtMoney(e.credit) : '-'}</td>
      <td class="text-right mono"><strong>${fmtMoney(e.balanceAfter)}</strong></td>
      <td class="text-muted">${escapeHtml(e.description || '')}</td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="table-empty">No ledger entries yet</td></tr>';
}

// ---------- Tabs ----------
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['purchases', 'payments', 'ledger'].forEach(t => {
    document.getElementById('tab-' + t).style.display = (t === btn.dataset.tab) ? '' : 'none';
  });
});

// ---------- Purchase modal ----------
function recalcPurchaseAmount() {
  const weight = Number(document.getElementById('pu-weight').value || 0);
  const rate = Number(document.getElementById('pu-rate').value || 0);
  document.getElementById('pu-amount').value = (weight * rate).toFixed(2);
}
['pu-weight', 'pu-rate'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcPurchaseAmount));

document.getElementById('record-purchase-btn').addEventListener('click', () => {
  document.getElementById('purchase-form').reset();
  document.getElementById('pu-date').value = todayIso();
  document.getElementById('purchase-form-error').innerHTML = '';
  openModal('purchase-modal');
});

document.getElementById('purchase-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    supplierId: Number(supplierId),
    purchaseDate: document.getElementById('pu-date').value,
    numberOfBirds: document.getElementById('pu-birds').value ? Number(document.getElementById('pu-birds').value) : null,
    numberOfBoxes: document.getElementById('pu-boxes').value ? Number(document.getElementById('pu-boxes').value) : null,
    purchaseWeight: Number(document.getElementById('pu-weight').value),
    purchaseRate: Number(document.getElementById('pu-rate').value),
    purchaseAmount: document.getElementById('pu-amount').value ? Number(document.getElementById('pu-amount').value) : null,
    notes: document.getElementById('pu-notes').value.trim(),
    createdBy: 'admin',
  };
  const btn = document.getElementById('purchase-save-btn');
  btn.disabled = true;
  try {
    await Api.post('/api/purchases', payload);
    showToast('Purchase recorded');
    closeModal('purchase-modal');
    await loadSupplierDetail();
  } catch (err) {
    document.getElementById('purchase-form-error').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Payment modal ----------
document.getElementById('record-payment-btn').addEventListener('click', () => {
  document.getElementById('payment-form').reset();
  document.getElementById('p-date').value = todayIso();
  document.getElementById('payment-form-error').innerHTML = '';
  openModal('payment-modal');
});

document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    supplierId: Number(supplierId),
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
    await Api.post('/api/supplier-payments', payload);
    showToast('Payment recorded');
    closeModal('payment-modal');
    await loadSupplierDetail();
  } catch (err) {
    document.getElementById('payment-form-error').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- PDF ----------
document.getElementById('generate-pdf-btn').addEventListener('click', async () => {
  try {
    const blob = await Api.getBlob(`/api/reports/supplier-purchase/${supplierId}`);
    openPdfBlob(blob, `supplier-purchase-${supplierId}.pdf`);
  } catch (err) {
    handleError(err);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadSupplierDetail, 50);
});

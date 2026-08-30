async function loadPurchasesPage() {
  try {
    const suppliers = await Api.get('/api/suppliers');
    document.getElementById('pu-supplier').innerHTML = suppliers
      .map(s => `<option value="${s.id}">${escapeHtml(s.supplierName)}</option>`).join('');
    await refreshPurchases();
  } catch (err) {
    handleError(err);
  }
}

async function refreshPurchases() {
  const from = document.getElementById('from-filter').value;
  const to = document.getElementById('to-filter').value;
  let url = '/api/purchases';
  if (from && to) url += `?from=${from}&to=${to}`;
  try {
    const list = await Api.get(url);
    renderPurchases(list);
  } catch (err) {
    handleError(err);
  }
}

function renderPurchases(list) {
  const admin = isAdmin();
  const body = document.getElementById('purchases-body');
  body.innerHTML = list.length ? list.map(p => `
    <tr>
      <td>${fmtDate(p.purchaseDate)}</td>
      <td><a href="supplier-detail.html?id=${p.supplierId}">${escapeHtml(p.supplierName)}</a></td>
      <td>${p.numberOfBirds ?? '-'}</td>
      <td>${p.numberOfBoxes ?? '-'}</td>
      <td>${fmtKg(p.purchaseWeight)}</td>
      <td>${fmtMoney(p.purchaseRate)}</td>
      <td class="text-right mono">${fmtMoney(p.purchaseAmount)}</td>
      <td>${admin ? `<button class="btn-danger btn-sm" onclick="deletePurchaseRow(${p.id})">Delete</button>` : ''}</td>
    </tr>
  `).join('') : '<tr><td colspan="8" class="table-empty">No purchases found for this period</td></tr>';

  const total = list.reduce((sum, p) => sum + Number(p.purchaseAmount), 0);
  const totalLine = document.getElementById('total-line');
  if (list.length) {
    totalLine.style.display = 'flex';
    totalLine.innerHTML = `<span>Total Purchase Cost</span><span class="mono">${fmtMoney(total)}</span>`;
  } else {
    totalLine.style.display = 'none';
  }
}

function recalcPurchaseAmount() {
  const weight = Number(document.getElementById('pu-weight').value || 0);
  const rate = Number(document.getElementById('pu-rate').value || 0);
  document.getElementById('pu-amount').value = (weight * rate).toFixed(2);
}
['pu-weight', 'pu-rate'].forEach(id =>
  document.getElementById(id).addEventListener('input', recalcPurchaseAmount));

document.getElementById('add-purchase-btn').addEventListener('click', () => {
  document.getElementById('purchase-form').reset();
  document.getElementById('pu-date').value = todayIso();
  document.getElementById('purchase-form-error').innerHTML = '';
  openModal('purchase-modal');
});

document.getElementById('purchase-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    supplierId: Number(document.getElementById('pu-supplier').value),
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
    await refreshPurchases();
  } catch (err) {
    document.getElementById('purchase-form-error').innerHTML =
      `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('apply-filter-btn').addEventListener('click', refreshPurchases);

async function deletePurchaseRow(id) {
  if (!confirm("Permanently delete this purchase? This updates the supplier's ledger balance. This cannot be undone.")) return;
  try {
    await Api.del(`/api/purchases/${id}`);
    showToast('Purchase deleted');
    await refreshPurchases();
  } catch (err) { handleError(err); }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadPurchasesPage, 50);
});

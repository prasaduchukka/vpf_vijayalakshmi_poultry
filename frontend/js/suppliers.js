let allSuppliers = [];

async function loadSuppliers() {
  try {
    allSuppliers = await Api.get('/api/suppliers');
    renderSuppliers(allSuppliers);
  } catch (err) {
    handleError(err);
  }
}

function renderSuppliers(list) {
  const admin = isAdmin();
  const body = document.getElementById('suppliers-body');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-empty">No suppliers yet. Click "Add Supplier" to get started.</td></tr>';
    return;
  }
  body.innerHTML = list.map(s => `
    <tr>
      <td><a href="supplier-detail.html?id=${s.id}">${escapeHtml(s.supplierName)}</a></td>
      <td>${escapeHtml(s.contactPerson || '-')}</td>
      <td>${escapeHtml(s.phoneNumber || '-')}</td>
      <td class="text-right mono">${fmtMoney(s.openingPayableBalance)}</td>
      <td>${statusBadge(s.status)}</td>
      <td>
        ${admin ? `<button class="btn-outline btn-sm" onclick="editSupplier(${s.id})">Edit</button>
        <button class="btn-danger btn-sm" onclick="deleteSupplier(${s.id})">Delete</button>` : '<span class="text-muted" style="font-size:12px;">View only</span>'}
      </td>
    </tr>
  `).join('');
}

async function deleteSupplier(id) {
  const s = allSuppliers.find(x => x.id === id);
  const name = s ? s.supplierName : 'this supplier';
  if (!confirm(`Permanently delete "${name}" and ALL their purchases, payments, and ledger history? This cannot be undone.`)) return;
  try {
    await Api.del(`/api/suppliers/${id}`);
    showToast('Supplier deleted');
    await loadSuppliers();
  } catch (err) { handleError(err); }
}

function editSupplier(id) {
  const s = allSuppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
  document.getElementById('s-id').value = s.id;
  document.getElementById('s-name').value = s.supplierName;
  document.getElementById('s-contact').value = s.contactPerson || '';
  document.getElementById('s-phone').value = s.phoneNumber || '';
  document.getElementById('s-address').value = s.address || '';
  document.getElementById('s-opening-balance').value = s.openingPayableBalance;
  document.getElementById('s-opening-balance').disabled = true;
  document.getElementById('s-opening-balance-hint').textContent = 'Opening payable cannot be changed after creation. Record a purchase or payment instead.';
  document.getElementById('s-status').value = s.status;
  document.getElementById('s-notes').value = s.notes || '';
  document.getElementById('supplier-form-error').innerHTML = '';
  openModal('supplier-modal');
}

document.getElementById('add-supplier-btn').addEventListener('click', () => {
  document.getElementById('supplier-form').reset();
  document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
  document.getElementById('s-id').value = '';
  document.getElementById('s-opening-balance').disabled = false;
  document.getElementById('s-opening-balance').value = 0;
  document.getElementById('s-opening-balance-hint').textContent = 'Only used when creating a new supplier.';
  document.getElementById('supplier-form-error').innerHTML = '';
  openModal('supplier-modal');
});

document.getElementById('supplier-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('s-id').value;
  const payload = {
    supplierName: document.getElementById('s-name').value.trim(),
    contactPerson: document.getElementById('s-contact').value.trim(),
    phoneNumber: document.getElementById('s-phone').value.trim(),
    address: document.getElementById('s-address').value.trim(),
    openingPayableBalance: Number(document.getElementById('s-opening-balance').value || 0),
    status: document.getElementById('s-status').value,
    notes: document.getElementById('s-notes').value.trim(),
  };
  const errorBox = document.getElementById('supplier-form-error');
  errorBox.innerHTML = '';
  const btn = document.getElementById('supplier-save-btn');
  btn.disabled = true;
  try {
    if (id) {
      await Api.put(`/api/suppliers/${id}`, payload);
      showToast('Supplier updated');
    } else {
      await Api.post('/api/suppliers', payload);
      showToast('Supplier added');
    }
    closeModal('supplier-modal');
    await loadSuppliers();
  } catch (err) {
    errorBox.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('search-box').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderSuppliers(allSuppliers.filter(s => s.supplierName.toLowerCase().includes(q)));
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadSuppliers, 50);
});

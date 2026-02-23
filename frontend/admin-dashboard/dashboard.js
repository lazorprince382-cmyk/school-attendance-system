(function () {
  const tabs = document.querySelectorAll('.tab');
  const sections = {
    children: document.getElementById('tab-children'),
    attendance: document.getElementById('tab-attendance'),
    history: document.getElementById('tab-history'),
    teachers: document.getElementById('tab-teachers'),
    export: document.getElementById('tab-export'),
  };

  const INACTIVITY_MINUTES = 10;
  const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

  function isStandalone() {
    if (typeof navigator !== 'undefined' && navigator.standalone) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;
    }
    return false;
  }

  function clearAuth() {
    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem('teacherName');
    window.localStorage.removeItem('teacherAccess');
  }

  function redirectToLogin() {
    clearAuth();
    window.location.href = '/admin/login.html';
  }

  function getToken() {
    return window.localStorage.getItem('authToken') || '';
  }

  function authHeaders() {
    return {
      Authorization: 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    };
  }

  function switchTab(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    Object.entries(sections).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('active', key === name);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
      if (tab.dataset.tab === 'history') loadHistoryDates();
      if (tab.dataset.tab === 'export') loadExportHistoryDates();
    });
  });

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('success', 'error');
    if (type) el.classList.add(type);
  }

  function formatHistoryDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return dateStr;
    const [, y, m, d] = match;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
    return `${dayName} ${d}/${m}/${y}`;
  }

  // Children & QR
  const registerChildForm = document.getElementById('register-child-form');
  const registerChildStatus = document.getElementById('register-child-status');
  const childFullNameInput = document.getElementById('child-full-name-input');
  const childClassInput = document.getElementById('child-class-input');
  const childParentPhoneInput = document.getElementById('child-parent-phone-input');
  const holderPhoto1 = document.getElementById('holder-photo-1');
  const holderPhoto2 = document.getElementById('holder-photo-2');
  const holderPhoto3 = document.getElementById('holder-photo-3');
  const refreshChildrenBtn = document.getElementById('refresh-children-btn');
  const generateQrBtn = document.getElementById('generate-qr-btn');
  const qrGrid = document.getElementById('qr-grid');
  const childrenTableBody = document.getElementById('children-table-body');

  registerChildForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = holderPhoto1.files?.[0];
    const p2 = holderPhoto2.files?.[0];
    const p3 = holderPhoto3.files?.[0];
    if (!p1 && !p2 && !p3) {
      setStatus(registerChildStatus, 'Please select at least one holder photo.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('fullName', (childFullNameInput.value || '').trim());
    formData.append('class', (childClassInput.value || '').trim());
    formData.append('parentPhone', (childParentPhoneInput.value || '').trim());
    if (p1) formData.append('photo1', p1);
    if (p2) formData.append('photo2', p2);
    if (p3) formData.append('photo3', p3);
    try {
      setStatus(registerChildStatus, 'Registering child...', 'info');
      const resp = await fetch('/api/children/register-with-pickers', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken() },
        body: formData,
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(registerChildStatus, json.error || 'Failed to register child.', 'error');
        return;
      }
      setStatus(registerChildStatus, 'Child registered. Their QR appears below.', 'success');
      childFullNameInput.value = '';
      childClassInput.value = '';
      childParentPhoneInput.value = '';
      holderPhoto1.value = '';
      holderPhoto2.value = '';
      holderPhoto3.value = '';
      await loadChildren();
      qrGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      setStatus(registerChildStatus, 'Network error while registering child.', 'error');
    }
  });

  let currentChildren = [];

  const STORAGE_KEY_QR_HIDDEN = 'adminQrGridHiddenIds';
  let qrGridHiddenIds = new Set();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_QR_HIDDEN);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) qrGridHiddenIds = new Set(arr.map(Number).filter((n) => !Number.isNaN(n)));
    }
  } catch (_) {}

  function saveQrGridHidden() {
    try {
      window.localStorage.setItem(STORAGE_KEY_QR_HIDDEN, JSON.stringify(Array.from(qrGridHiddenIds)));
    } catch (_) {}
  }

  let childrenSearchQuery = '';
  let childrenFilterClass = '';

  async function loadChildren() {
    try {
      const resp = await fetch('/api/children', {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const children = await resp.json();
      currentChildren = children || [];
      updateChildrenFilterClassOptions();
      renderChildrenTable();
      renderQrGrid(currentChildren);
    } catch (err) {
      console.error(err);
    }
  }

  function parseFullName(fullName) {
    const trimmed = (fullName || '').trim();
    if (!trimmed) return { firstName: '', lastName: '' };
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) return { firstName: trimmed, lastName: '' };
    return {
      firstName: trimmed.slice(0, firstSpace).trim(),
      lastName: trimmed.slice(firstSpace + 1).trim(),
    };
  }

  function downloadQrForChild(child) {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.width = '200px';
    div.style.height = '200px';
    document.body.appendChild(div);
    new QRCode(div, {
      text: String(child.id),
      width: 200,
      height: 200,
      correctLevel: typeof QRCode !== 'undefined' && QRCode.CorrectLevel ? QRCode.CorrectLevel.L : 0,
    });
    const canvas = div.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const safeName = `${child.first_name}-${child.last_name}-${child.class_name || 'N'}`.replace(/\s+/g, '-');
      triggerDownload(dataUrl, safeName);
    }
    document.body.removeChild(div);
  }

  function getUniqueClasses(children) {
    const set = new Set();
    (children || []).forEach((c) => {
      const cn = (c.class_name || '').trim();
      if (cn) set.add(cn);
    });
    return Array.from(set).sort();
  }

  function updateChildrenFilterClassOptions() {
    const sel = document.getElementById('children-filter-class');
    if (!sel) return;
    const current = sel.value;
    const classes = getUniqueClasses(currentChildren);
    sel.innerHTML = '<option value="">All classes</option>' + classes.map((cls) => `<option value="${escapeHtml(cls)}">${escapeHtml(cls)}</option>`).join('');
    if (classes.includes(current)) sel.value = current;
    else {
      childrenFilterClass = '';
      sel.value = '';
    }
  }

  function renderChildrenTable() {
    if (!childrenTableBody) return;
    childrenTableBody.innerHTML = '';
    const byId = new Map();
    (currentChildren || []).forEach((c) => {
      if (c && c.id != null && !byId.has(c.id)) byId.set(c.id, c);
    });
    let toShow = Array.from(byId.values());
    const q = (childrenSearchQuery || '').trim().toLowerCase();
    if (q) {
      toShow = toShow.filter((c) => {
        const fullName = `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim().toLowerCase();
        return fullName.includes(q);
      });
    }
    if (childrenFilterClass) {
      toShow = toShow.filter((c) => (c.class_name || '').trim() === childrenFilterClass);
    }
    toShow.forEach((c) => {
      const tr = document.createElement('tr');
      const fullName = `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim() || '—';
      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${escapeHtml(fullName)}</td>
        <td>${escapeHtml(c.class_name || '—')}</td>
        <td>${escapeHtml(c.guardian_phone || '—')}</td>
        <td>
          <button type="button" class="btn-secondary btn-small" data-action="edit" data-id="${c.id}">Edit</button>
          <button type="button" class="btn-secondary btn-small" data-action="download" data-id="${c.id}">Download QR</button>
          <button type="button" class="btn-danger btn-small" data-action="delete" data-id="${c.id}">Delete</button>
        </td>
      `;
      childrenTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getChildById(id) {
    return currentChildren.find((c) => Number(c.id) === Number(id)) || null;
  }

  const childrenSearchInput = document.getElementById('children-search-input');
  const childrenFilterClassSelect = document.getElementById('children-filter-class');
  if (childrenSearchInput) {
    childrenSearchInput.addEventListener('input', () => {
      childrenSearchQuery = childrenSearchInput.value;
      renderChildrenTable();
    });
  }
  if (childrenFilterClassSelect) {
    childrenFilterClassSelect.addEventListener('change', () => {
      childrenFilterClass = (childrenFilterClassSelect.value || '').trim();
      renderChildrenTable();
    });
  }

  if (childrenTableBody) {
    childrenTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (!id || !action) return;
      const child = getChildById(id);
      if (!child) return;

      if (action === 'delete') {
        const name = `${child.first_name} ${child.last_name}`.trim();
        if (!window.confirm(`Permanently delete "${name}" from the system? This will remove the child, their authorized pickers, and attendance records. This cannot be undone.`)) return;
        try {
          const resp = await fetch(`/api/children/${id}`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + getToken() },
          });
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            alert(err.error || 'Failed to delete child.');
            return;
          }
          await loadChildren();
        } catch (err) {
          console.error(err);
          alert('Failed to delete child. Please try again.');
        }
        return;
      }

      if (action === 'download') {
        downloadQrForChild(child);
        return;
      }

      if (action === 'edit') {
        openEditChildModal(child);
      }
    });
  }

  // QR encodes id + fullName so scanner can look up child by id and show name + 3 photos
  function downloadQrAsPng(qrItem, fileName, childId, onDone) {
    const container = qrItem.querySelector('.qr-code-container');
    if (!container) return;
    const canvas = container.querySelector('canvas');
    const img = container.querySelector('img');
    let dataUrl = null;
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png');
    } else if (img && img.src) {
      dataUrl = img.src;
    }
    function afterDownload() {
      if (typeof onDone === 'function') onDone();
      loadChildren();
    }
    if (!dataUrl && typeof html2canvas === 'function') {
      html2canvas(container, { scale: 2, useCORS: true }).then((c) => {
        dataUrl = c.toDataURL('image/png');
        triggerDownload(dataUrl, fileName);
        afterDownload();
      }).catch(afterDownload);
      return;
    }
    if (dataUrl) {
      triggerDownload(dataUrl, fileName);
      afterDownload();
    }
  }

  function triggerDownload(dataUrl, fileName) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = (fileName || 'child-qr').replace(/[^a-zA-Z0-9-_.\s]/g, '') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // One QR per child: scan it to load this child and their 3 holder photos. Delete only hides from grid.
  function renderQrGrid(children) {
    qrGrid.innerHTML = '';
    const byId = new Map();
    (children || []).forEach((c) => {
      if (c && c.id != null && !byId.has(c.id)) byId.set(c.id, c);
    });
    const unique = Array.from(byId.values());
    const toShow = unique.filter((c) => !qrGridHiddenIds.has(Number(c.id)));
    toShow.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'qr-item';
      const qrCodeContainer = document.createElement('div');
      qrCodeContainer.className = 'qr-code-container';
      qrCodeContainer.style.width = '200px';
      qrCodeContainer.style.height = '200px';
      const label = document.createElement('div');
      label.className = 'qr-label';
      label.textContent = `${c.first_name} ${c.last_name} (${c.class_name || ''})`;
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'btn-download-qr';
      downloadBtn.textContent = 'Download';
      const safeName = `${c.first_name}-${c.last_name}-${c.class_name || 'N'}`.replace(/\s+/g, '-');
      downloadBtn.addEventListener('click', () => {
        downloadQrAsPng(item, safeName, c.id, null);
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-qr';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        const name = `${c.first_name} ${c.last_name}`.trim();
        if (!window.confirm('Remove this QR from the grid? The child stays in the system. You can show it again with "Show hidden".')) return;
        qrGridHiddenIds.add(Number(c.id));
        saveQrGridHidden();
        renderQrGrid(currentChildren);
        updateShowHiddenBtn();
      });
      item.appendChild(qrCodeContainer);
      item.appendChild(label);
      const btnRow = document.createElement('div');
      btnRow.className = 'qr-item-btns';
      btnRow.appendChild(downloadBtn);
      btnRow.appendChild(deleteBtn);
      item.appendChild(btnRow);
      qrGrid.appendChild(item);

      const qrData = String(c.id);
      // eslint-disable-next-line no-new
      new QRCode(qrCodeContainer, {
        text: qrData,
        width: 200,
        height: 200,
        correctLevel: typeof QRCode !== 'undefined' && QRCode.CorrectLevel ? QRCode.CorrectLevel.L : 0,
      });
    });
    updateShowHiddenBtn();
  }

  function updateShowHiddenBtn() {
    const btn = document.getElementById('show-hidden-qr-btn');
    if (!btn) return;
    const n = qrGridHiddenIds.size;
    btn.textContent = n > 0 ? `Show hidden (${n})` : 'Show hidden';
    btn.disabled = n === 0;
  }

  refreshChildrenBtn.addEventListener('click', () => {
    loadChildren();
  });
  generateQrBtn.addEventListener('click', () => {
    renderQrGrid(currentChildren);
  });

  const hiddenQrModal = document.getElementById('hidden-qr-modal');
  const hiddenQrListEl = document.getElementById('hidden-qr-list');
  const hiddenQrModalCloseBtn = document.getElementById('hidden-qr-modal-close');

  function openHiddenQrModal() {
    renderHiddenQrList();
    if (hiddenQrModal) {
      hiddenQrModal.setAttribute('aria-hidden', 'false');
      hiddenQrModal.classList.add('modal-open');
    }
  }

  function closeHiddenQrModal() {
    if (hiddenQrModal) {
      hiddenQrModal.setAttribute('aria-hidden', 'true');
      hiddenQrModal.classList.remove('modal-open');
    }
  }

  function renderHiddenQrList() {
    if (!hiddenQrListEl) return;
    const hiddenChildren = (currentChildren || []).filter((c) => c && c.id != null && qrGridHiddenIds.has(Number(c.id)));
    hiddenQrListEl.innerHTML = '';
    if (hiddenChildren.length === 0) {
      hiddenQrListEl.innerHTML = '<p class="small muted">No hidden QR codes.</p>';
      return;
    }
    hiddenChildren.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'hidden-qr-row';
      const fullName = `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim() || '—';
      const className = (c.class_name || '').trim() || '—';
      row.innerHTML = `
        <span class="hidden-qr-name">${escapeHtml(fullName)}</span>
        <span class="hidden-qr-class">${escapeHtml(className)}</span>
        <button type="button" class="btn-primary btn-small btn-unhide-qr" data-id="${c.id}">Unhide</button>
      `;
      const unhideBtn = row.querySelector('.btn-unhide-qr');
      if (unhideBtn) {
        unhideBtn.addEventListener('click', () => {
          qrGridHiddenIds.delete(Number(c.id));
          saveQrGridHidden();
          renderQrGrid(currentChildren);
          updateShowHiddenBtn();
          renderHiddenQrList();
          if (qrGridHiddenIds.size === 0) closeHiddenQrModal();
        });
      }
      hiddenQrListEl.appendChild(row);
    });
  }

  const showHiddenQrBtn = document.getElementById('show-hidden-qr-btn');
  if (showHiddenQrBtn) {
    showHiddenQrBtn.addEventListener('click', openHiddenQrModal);
  }
  if (hiddenQrModalCloseBtn) {
    hiddenQrModalCloseBtn.addEventListener('click', closeHiddenQrModal);
  }
  if (hiddenQrModal) {
    hiddenQrModal.addEventListener('click', (e) => {
      if (e.target === hiddenQrModal) closeHiddenQrModal();
    });
  }

  // Edit child modal
  let editingChildId = null;
  let editingPickers = []; // [{ id, sortOrder }, ...] after fetch, sorted
  const editChildModal = document.getElementById('edit-child-modal');
  const editChildForm = document.getElementById('edit-child-form');
  const editChildFullName = document.getElementById('edit-child-full-name');
  const editChildClass = document.getElementById('edit-child-class');
  const editChildParentPhone = document.getElementById('edit-child-parent-phone');
  const holderPhotosEdit = document.getElementById('holder-photos-edit');
  const editChildCancel = document.getElementById('edit-child-cancel');
  const editChildStatus = document.getElementById('edit-child-status');

  function openEditChildModal(child) {
    editingChildId = child.id;
    editingPickers = [];
    editChildFullName.value = `${(child.first_name || '').trim()} ${(child.last_name || '').trim()}`.trim();
    editChildClass.value = (child.class_name || '').trim();
    editChildParentPhone.value = (child.guardian_phone || '').trim();
    setStatus(editChildStatus, '', '');
    holderPhotosEdit.querySelectorAll('.holder-replace-input').forEach((inp) => { inp.value = ''; });
    holderPhotosEdit.querySelectorAll('.holder-name-input').forEach((inp) => { inp.value = ''; });
    holderPhotosEdit.querySelectorAll('.holder-thumb').forEach((img) => { img.src = ''; img.onerror = null; img.style.display = ''; img.style.visibility = 'visible'; });
    holderPhotosEdit.querySelectorAll('.holder-thumb-placeholder').forEach((el) => el.remove());
    holderPhotosEdit.querySelectorAll('.holder-edit-slot').forEach((slot) => { slot.style.display = ''; slot.removeAttribute('data-picker-id'); });

    fetch(`/api/children/${child.id}/pickers`, { headers: { Authorization: 'Bearer ' + getToken() } })
      .then((resp) => resp.json())
      .then((pickers) => {
        const sorted = (pickers || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        editingPickers = sorted;
        const slots = holderPhotosEdit.querySelectorAll('.holder-edit-slot');
        const origin = (window.location.origin || '').replace(/\/$/, '');
        const toFullUrl = (url) => {
          if (!url || typeof url !== 'string') return '';
          if (url.startsWith('http')) return url;
          const path = url.startsWith('/') ? url : '/' + url;
          return origin ? origin + path : url;
        };
        sorted.forEach((p, i) => {
          if (!slots[i]) return;
          slots[i].setAttribute('data-picker-id', p.id);
          const wrap = slots[i].querySelector('.holder-thumb-wrap');
          const thumb = slots[i].querySelector('.holder-thumb');
          // Remove any "Photo missing" placeholder from a previous load
          const existingPlaceholder = wrap && wrap.querySelector('.holder-thumb-placeholder');
          if (existingPlaceholder) existingPlaceholder.remove();
          if (thumb) {
            thumb.style.display = '';
            thumb.style.visibility = 'visible';
            if (p.photoUrl) {
              thumb.src = toFullUrl(p.photoUrl) + '?v=' + (p.id || i);
              thumb.onerror = () => {
                thumb.style.display = 'none';
                const span = document.createElement('span');
                span.className = 'holder-thumb-placeholder';
                span.textContent = 'Photo missing';
                if (wrap) wrap.appendChild(span);
              };
            } else {
              thumb.src = '';
              thumb.style.display = 'none';
              if (wrap) {
                const span = document.createElement('span');
                span.className = 'holder-thumb-placeholder';
                span.textContent = 'No photo';
                wrap.appendChild(span);
              }
            }
          }
          const nameInput = slots[i].querySelector('.holder-name-input');
          if (nameInput) {
            const displayName = (p.name != null && String(p.name).trim() !== '') ? String(p.name).trim() : `Holder ${i + 1}`;
            nameInput.value = displayName;
          }
        });
        for (let i = sorted.length; i < 3; i++) {
          if (slots[i]) slots[i].style.display = 'none';
        }
      })
      .catch((err) => {
        console.error(err);
        setStatus(editChildStatus, 'Could not load holder photos.', 'error');
      });

    if (editChildModal) {
      editChildModal.setAttribute('aria-hidden', 'false');
      editChildModal.classList.add('modal-open');
    }
  }

  function closeEditChildModal() {
    editingChildId = null;
    editingPickers = [];
    holderPhotosEdit.querySelectorAll('.holder-thumb[data-revoke-url]').forEach((img) => {
      if (img.dataset.revokeUrl) {
        URL.revokeObjectURL(img.dataset.revokeUrl);
        delete img.dataset.revokeUrl;
      }
    });
    if (editChildModal) {
      editChildModal.setAttribute('aria-hidden', 'true');
      editChildModal.classList.remove('modal-open');
    }
    setStatus(editChildStatus, '', '');
  }

  if (editChildCancel) {
    editChildCancel.addEventListener('click', closeEditChildModal);
  }
  if (editChildModal) {
    editChildModal.addEventListener('click', (e) => {
      if (e.target === editChildModal) closeEditChildModal();
    });
  }

  holderPhotosEdit.addEventListener('change', (e) => {
    const fileInput = e.target.closest('.holder-edit-slot') && e.target.classList.contains('holder-replace-input') ? e.target : null;
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const slot = fileInput.closest('.holder-edit-slot');
    const nameInput = slot && slot.querySelector('.holder-name-input');
    if (nameInput) {
      const fileName = (fileInput.files[0].name || '').trim();
      const nameFromFile = fileName ? fileName.replace(/\.[^.]+$/, '').trim() : '';
      if (nameFromFile) nameInput.value = nameFromFile;
    }
    // Show chosen photo in the thumb so the user sees it before saving
    const thumb = slot && slot.querySelector('.holder-thumb');
    const wrap = slot && slot.querySelector('.holder-thumb-wrap');
    const placeholder = wrap && wrap.querySelector('.holder-thumb-placeholder');
    if (placeholder) placeholder.remove();
    if (thumb && wrap) {
      const url = URL.createObjectURL(fileInput.files[0]);
      thumb.src = url;
      thumb.style.display = '';
      thumb.style.visibility = 'visible';
      thumb.onerror = null;
      thumb.dataset.revokeUrl = url;
    }
  });

  if (editChildForm) {
    editChildForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editingChildId == null) return;
      const fullName = (editChildFullName.value || '').trim();
      if (!fullName) {
        setStatus(editChildStatus, 'Full name is required.', 'error');
        return;
      }
      const { firstName, lastName } = parseFullName(fullName);
      setStatus(editChildStatus, 'Saving...', 'info');
      try {
        const resp = await fetch(`/api/children/${editingChildId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            firstName,
            lastName,
            className: (editChildClass.value || '').trim() || null,
            guardianPhone: (editChildParentPhone.value || '').trim() || null,
          }),
        });
        if (!resp.ok) {
          const json = await resp.json().catch(() => ({}));
          setStatus(editChildStatus, json.error || 'Failed to update child.', 'error');
          return;
        }
        const slots = holderPhotosEdit.querySelectorAll('.holder-edit-slot');
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const pickerId = slot.getAttribute('data-picker-id');
          if (!pickerId) continue;
          const fileInput = slot.querySelector('.holder-replace-input');
          const nameInput = slot.querySelector('.holder-name-input');
          const fd = new FormData();
          fd.append('pickerIndex', String(i));
          const holderName = (nameInput && nameInput.value) ? String(nameInput.value).trim() : `Holder ${i + 1}`;
          fd.append('name', holderName || `Holder ${i + 1}`);
          if (fileInput && fileInput.files && fileInput.files[0]) {
            fd.append('photo', fileInput.files[0]);
          }
          const pr = await fetch(`/api/children/${editingChildId}/pickers/${pickerId}`, {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + getToken() },
            body: fd,
          });
          if (!pr.ok) {
            const j = await pr.json().catch(() => ({}));
            setStatus(editChildStatus, j.error || 'Failed to update holder.', 'error');
            return;
          }
        }
        setStatus(editChildStatus, 'Child updated.', 'success');
        await loadChildren();
        setTimeout(closeEditChildModal, 800);
      } catch (err) {
        console.error(err);
        setStatus(editChildStatus, 'Network error.', 'error');
      }
    });
  }

  // Today attendance
  const refreshAttendanceBtn = document.getElementById('refresh-attendance-btn');
  const attendanceSummary = document.getElementById('attendance-summary');
  const attendanceTableBody = document.querySelector('#attendance-table tbody');

  async function loadAttendanceToday() {
    try {
      const resp = await fetch('/api/attendance/today', {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const data = await resp.json();
      attendanceSummary.textContent = `Date: ${data.date} · Records: ${data.count}`;
      attendanceTableBody.innerHTML = '';
      (data.records || []).forEach((r) => {
        const tr = document.createElement('tr');
        const childName = r.child_name != null ? escapeHtml(r.child_name) : String(r.child_id);
        const childClass = (r.class_name != null && String(r.class_name).trim() !== '')
          ? String(r.class_name).trim()
          : (r.child_class != null && String(r.child_class).trim() !== '')
            ? String(r.child_class).trim()
            : '—';
        const teacherName = r.teacher_name != null ? escapeHtml(r.teacher_name) : (r.teacher_id != null ? String(r.teacher_id) : '—');
        const pickerName = r.picker_name != null ? escapeHtml(r.picker_name) : '—';
        tr.innerHTML = `
          <td>${r.id}</td>
          <td>${childName}</td>
          <td>${escapeHtml(childClass)}</td>
          <td>${teacherName}</td>
          <td>${pickerName}</td>
          <td>${r.action}</td>
          <td>${new Date(r.timestamp).toLocaleString()}</td>
        `;
        attendanceTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  }

  refreshAttendanceBtn.addEventListener('click', loadAttendanceToday);

  // History departures
  const refreshHistoryDatesBtn = document.getElementById('refresh-history-dates-btn');
  const historySearchDate = document.getElementById('history-search-date');
  const historySearchBtn = document.getElementById('history-search-btn');
  const historyFilterMonth = document.getElementById('history-filter-month');
  const historyDatesSummary = document.getElementById('history-dates-summary');
  const historyDatesList = document.getElementById('history-dates-list');
  const historyTableWrap = document.getElementById('history-table-wrap');
  const historyTableTitle = document.getElementById('history-table-title');
  const historyTableBody = document.querySelector('#history-attendance-table-body');
  let selectedHistoryDate = null;
  let allHistoryDates = [];

  function buildAttendanceRow(r) {
    const childName = r.child_name != null ? escapeHtml(r.child_name) : String(r.child_id);
    const childClass = (r.class_name != null && String(r.class_name).trim() !== '')
      ? String(r.class_name).trim()
      : (r.child_class != null && String(r.child_class).trim() !== '')
        ? String(r.child_class).trim()
        : '—';
    const teacherName = r.teacher_name != null ? escapeHtml(r.teacher_name) : (r.teacher_id != null ? String(r.teacher_id) : '—');
    const pickerName = r.picker_name != null ? escapeHtml(r.picker_name) : '—';
    return `<tr>
      <td>${r.id}</td>
      <td>${childName}</td>
      <td>${escapeHtml(childClass)}</td>
      <td>${teacherName}</td>
      <td>${pickerName}</td>
      <td>${r.action}</td>
      <td>${new Date(r.timestamp).toLocaleString()}</td>
    </tr>`;
  }

  function getFilteredHistoryDates() {
    const monthVal = historyFilterMonth && historyFilterMonth.value ? historyFilterMonth.value.trim() : '';
    if (!monthVal) return allHistoryDates;
    return allHistoryDates.filter((d) => {
      const match = d.match(/^(\d{4}-\d{2})/);
      return match && match[1] === monthVal;
    });
  }

  function renderHistoryDatesList(dates) {
    historyDatesList.innerHTML = '';
    selectedHistoryDate = null;
    const filtered = dates || [];
    historyDatesSummary.textContent = filtered.length
      ? `${filtered.length} day(s) with departures`
      : allHistoryDates.length
        ? 'No dates in this month.'
        : 'No departure dates yet.';
    filtered.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'history-date-row';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary history-date-btn';
      btn.textContent = formatHistoryDate(d);
      btn.title = 'Click to show or hide this day\'s departures';
      btn.dataset.date = d;
      btn.addEventListener('click', () => toggleHistoryByDate(d, btn));
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'history-date-actions';
      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'history-date-menu-btn';
      menuBtn.setAttribute('aria-label', 'Options');
      menuBtn.innerHTML = '&#8942;';
      menuBtn.title = 'View or delete this day\'s records';
      const menu = document.createElement('div');
      menu.className = 'history-date-menu';
      menu.setAttribute('hidden', '');
      const viewOpt = document.createElement('button');
      viewOpt.type = 'button';
      viewOpt.className = 'history-date-menu-option';
      viewOpt.textContent = 'View';
      viewOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.setAttribute('hidden', '');
        toggleHistoryByDate(d, btn);
      });
      const deleteOpt = document.createElement('button');
      deleteOpt.type = 'button';
      deleteOpt.className = 'history-date-menu-option history-date-menu-option-danger';
      deleteOpt.textContent = 'Delete';
      deleteOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.setAttribute('hidden', '');
        deleteHistoryByDate(d);
      });
      menu.appendChild(viewOpt);
      menu.appendChild(deleteOpt);
      menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = document.querySelector('.history-date-menu:not([hidden])');
        if (open && open !== menu) open.setAttribute('hidden', '');
        if (menu.hasAttribute('hidden')) {
          menu.removeAttribute('hidden');
        } else {
          menu.setAttribute('hidden', '');
        }
      });
      actionsWrap.appendChild(menuBtn);
      actionsWrap.appendChild(menu);
      row.appendChild(btn);
      row.appendChild(actionsWrap);
      historyDatesList.appendChild(row);
    });
    historyTableWrap.style.display = 'none';
  }

  async function loadHistoryDates() {
    try {
      const resp = await fetch('/api/attendance/dates', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await resp.json();
      allHistoryDates = data.dates || [];
      const months = [...new Set(allHistoryDates.map((d) => {
        const m = d.match(/^(\d{4}-\d{2})/);
        return m ? m[1] : null;
      }).filter(Boolean))].sort().reverse();
      if (historyFilterMonth) {
        const currentVal = historyFilterMonth.value || '';
        historyFilterMonth.innerHTML = '<option value="">All months</option>' +
          months.map((ym) => {
            const [y, m] = ym.split('-');
            const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            return '<option value="' + ym + '">' + label + '</option>';
          }).join('');
        if (months.includes(currentVal)) historyFilterMonth.value = currentVal;
      }
      renderHistoryDatesList(getFilteredHistoryDates());
      return allHistoryDates;
    } catch (err) {
      console.error(err);
      historyDatesSummary.textContent = 'Could not load dates.';
      allHistoryDates = [];
      return [];
    }
  }

  async function searchHistoryByDate() {
    const raw = historySearchDate && historySearchDate.value ? historySearchDate.value.trim() : '';
    if (!raw) {
      alert('Please pick a date to search.');
      return;
    }
    const dateStr = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? raw : null;
    if (!dateStr) {
      alert('Please use a valid date (YYYY-MM-DD).');
      return;
    }
    try {
      const resp = await fetch('/api/attendance/by-date?date=' + encodeURIComponent(dateStr), {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!resp.ok) {
        historyTableTitle.textContent = 'Departures · ' + formatHistoryDate(dateStr);
        historyTableBody.innerHTML = '<tr><td colspan="7">No records for this date.</td></tr>';
        historyTableWrap.style.display = 'block';
        return;
      }
      const data = await resp.json();
      historyTableTitle.textContent = 'Departures · ' + formatHistoryDate(dateStr);
      historyTableBody.innerHTML = '';
      (data.records || []).forEach((r) => {
        historyTableBody.insertAdjacentHTML('beforeend', buildAttendanceRow(r));
      });
      if ((data.records || []).length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="7">No records for this date.</td></tr>';
      }
      historyTableWrap.style.display = 'block';
      selectedHistoryDate = dateStr;
      historyDatesList.querySelectorAll('.history-date-btn').forEach((b) => b.classList.remove('selected'));
      const btn = historyDatesList.querySelector('.history-date-btn[data-date="' + dateStr + '"]');
      if (btn) btn.classList.add('selected');
    } catch (err) {
      console.error(err);
      historyTableTitle.textContent = 'Departures · ' + formatHistoryDate(dateStr);
      historyTableBody.innerHTML = '<tr><td colspan="7">Could not load departures.</td></tr>';
      historyTableWrap.style.display = 'block';
    }
  }

  async function toggleHistoryByDate(dateStr, clickedBtn) {
    const isSameAndVisible = selectedHistoryDate === dateStr && historyTableWrap.style.display !== 'none';
    if (isSameAndVisible) {
      historyTableWrap.style.display = 'none';
      selectedHistoryDate = null;
      historyDatesList.querySelectorAll('.history-date-btn').forEach((b) => b.classList.remove('selected'));
      return;
    }
    try {
      const resp = await fetch('/api/attendance/by-date?date=' + encodeURIComponent(dateStr), {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.error('History by date failed', resp.status, errData);
        historyTableBody.innerHTML = '<tr><td colspan="7">Could not load departures for this date.</td></tr>';
        historyTableWrap.style.display = 'block';
        selectedHistoryDate = dateStr;
        historyDatesList.querySelectorAll('.history-date-btn').forEach((b) => b.classList.remove('selected'));
        if (clickedBtn) clickedBtn.classList.add('selected');
        return;
      }
      const data = await resp.json();
      historyTableTitle.textContent = 'Departures · ' + formatHistoryDate(dateStr);
      historyTableBody.innerHTML = '';
      (data.records || []).forEach((r) => {
        historyTableBody.insertAdjacentHTML('beforeend', buildAttendanceRow(r));
      });
      historyTableWrap.style.display = 'block';
      selectedHistoryDate = dateStr;
      historyDatesList.querySelectorAll('.history-date-btn').forEach((b) => b.classList.remove('selected'));
      if (clickedBtn) clickedBtn.classList.add('selected');
    } catch (err) {
      console.error(err);
      historyTableBody.innerHTML = '<tr><td colspan="7">Could not load departures.</td></tr>';
      historyTableWrap.style.display = 'block';
      selectedHistoryDate = dateStr;
    }
  }

  function loadHistoryByDate(dateStr) {
    const btn = historyDatesList.querySelector('.history-date-btn[data-date="' + dateStr + '"]');
    toggleHistoryByDate(dateStr, btn || null);
  }

  function closeHistoryMenus() {
    historyDatesList.querySelectorAll('.history-date-menu').forEach((m) => m.setAttribute('hidden', ''));
  }

  async function deleteHistoryByDate(dateStr) {
    const label = formatHistoryDate(dateStr);
    if (!confirm('Delete all departure records for ' + label + '? This cannot be undone.')) return;
    try {
      const resp = await fetch('/api/attendance/by-date?date=' + encodeURIComponent(dateStr), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(err.error || 'Failed to delete.');
        return;
      }
      if (selectedHistoryDate === dateStr) {
        historyTableWrap.style.display = 'none';
        selectedHistoryDate = null;
        historyDatesList.querySelectorAll('.history-date-btn').forEach((b) => b.classList.remove('selected'));
      }
      await loadHistoryDates();
    } catch (err) {
      console.error(err);
      alert('Failed to delete.');
    }
  }

  if (refreshHistoryDatesBtn) refreshHistoryDatesBtn.addEventListener('click', loadHistoryDates);
  if (historySearchBtn) historySearchBtn.addEventListener('click', searchHistoryByDate);
  if (historyFilterMonth) historyFilterMonth.addEventListener('change', () => renderHistoryDatesList(getFilteredHistoryDates()));
  document.addEventListener('click', closeHistoryMenus);

  // Export from history: list of dates with download button each
  const exportHistoryDatesList = document.getElementById('export-history-dates-list');
  const exportHistoryHint = document.getElementById('export-history-hint');

  async function loadExportHistoryDates() {
    if (!exportHistoryDatesList) return;
    try {
      const resp = await fetch('/api/attendance/dates', { headers: { Authorization: 'Bearer ' + getToken() } });
      const data = await resp.json();
      const dates = data.dates || [];
      exportHistoryHint.textContent = dates.length ? 'Click a date to download that day’s CSV.' : 'No departure dates yet.';
      exportHistoryDatesList.innerHTML = '';
      dates.forEach((d) => {
        const wrap = document.createElement('div');
        wrap.className = 'export-date-row';
        const label = document.createElement('span');
        label.textContent = formatHistoryDate(d);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary btn-small';
        btn.textContent = 'Download CSV';
        btn.addEventListener('click', () => {
          const url = '/api/attendance/export?date=' + encodeURIComponent(d);
          fetch(url, { headers: { Authorization: 'Bearer ' + getToken() } })
            .then((r) => r.blob())
            .then((blob) => {
              const a = document.createElement('a');
              a.href = window.URL.createObjectURL(blob);
              a.download = 'departures-' + d + '.csv';
              a.click();
              window.URL.revokeObjectURL(a.href);
            })
            .catch((e) => console.error(e));
        });
        wrap.appendChild(label);
        wrap.appendChild(btn);
        exportHistoryDatesList.appendChild(wrap);
      });
    } catch (err) {
      console.error(err);
      exportHistoryHint.textContent = 'Could not load dates.';
    }
  }

  // Teachers
  const addTeacherForm = document.getElementById('add-teacher-form');
  const teacherNameInput = document.getElementById('teacher-name-input');
  const teacherPhoneInput = document.getElementById('teacher-phone-input');
  const teacherPinInput = document.getElementById('teacher-pin-input');
  const teacherAccessInput = document.getElementById('teacher-access-input');
  const teachersStatus = document.getElementById('teachers-status');
  const refreshTeachersBtn = document.getElementById('refresh-teachers-btn');
  const teachersTableBody = document.querySelector('#teachers-table tbody');

  addTeacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/teachers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: teacherNameInput.value,
          phone: teacherPhoneInput.value,
          pin: teacherPinInput.value,
          access: (teacherAccessInput && teacherAccessInput.value) || 'both',
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(teachersStatus, json.error || 'Failed to add teacher.', 'error');
        return;
      }
      setStatus(teachersStatus, 'Teacher added.', 'success');
      teacherNameInput.value = '';
      teacherPhoneInput.value = '';
      teacherPinInput.value = '';
      if (teacherAccessInput) teacherAccessInput.value = 'both';
      await loadTeachers();
    } catch (err) {
      console.error(err);
      setStatus(teachersStatus, 'Network error while adding teacher.', 'error');
    }
  });

  function accessLabel(access) {
    if (access === 'scanner') return 'Scanner only';
    if (access === 'admin') return 'Admin only';
    return 'Both';
  }

  async function loadTeachers() {
    try {
      const resp = await fetch('/api/teachers', {
        headers: { Authorization: 'Bearer ' + getToken() },
      });
      const teachers = await resp.json();
      teachersTableBody.innerHTML = '';
      (teachers || []).forEach((t) => {
        const tr = document.createElement('tr');
        const accessVal = t.access === 'scanner' || t.access === 'admin' ? t.access : 'both';
        tr.innerHTML = `
          <td>${t.id}</td>
          <td>${t.name}</td>
          <td>${t.phone}</td>
          <td>
            <select class="access-select" data-id="${t.id}" data-access="${accessVal}">
              <option value="both" ${accessVal === 'both' ? 'selected' : ''}>Both</option>
              <option value="scanner" ${accessVal === 'scanner' ? 'selected' : ''}>Scanner only</option>
              <option value="admin" ${accessVal === 'admin' ? 'selected' : ''}>Admin only</option>
            </select>
          </td>
          <td>${t.is_active ? 'Yes' : 'No'}</td>
          <td>
            <button class="btn-secondary btn-small" data-action="toggle" data-id="${t.id}">
              ${t.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn-danger btn-small" data-action="remove" data-id="${t.id}">
              Remove
            </button>
          </td>
        `;
        teachersTableBody.appendChild(tr);
      });
      teachersTableBody.querySelectorAll('.access-select').forEach((sel) => {
        sel.addEventListener('change', async () => {
          const id = sel.getAttribute('data-id');
          const access = sel.value;
          try {
            const resp = await fetch(`/api/teachers/${id}`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ access }),
            });
            if (!resp.ok) {
              const json = await resp.json().catch(() => ({}));
              setStatus(teachersStatus, json.error || 'Failed to update access.', 'error');
              return;
            }
            setStatus(teachersStatus, 'Access updated.', 'success');
            sel.setAttribute('data-access', access);
          } catch (err) {
            console.error(err);
            setStatus(teachersStatus, 'Network error.', 'error');
          }
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  teachersTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id || !action) return;

    if (action === 'remove') {
      if (!window.confirm('Remove this teacher?')) return;
      try {
        const resp = await fetch(`/api/teachers/${id}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + getToken() },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setStatus(teachersStatus, json.error || 'Failed to remove teacher.', 'error');
          return;
        }
        setStatus(teachersStatus, 'Teacher removed.', 'success');
        await loadTeachers();
      } catch (err) {
        console.error(err);
        setStatus(teachersStatus, 'Network error while removing teacher.', 'error');
      }
    } else if (action === 'toggle') {
      try {
        const row = btn.closest('tr');
        const isActiveText = row.children[4].textContent.trim();
        const isActive = isActiveText === 'Yes';
        const resp = await fetch(`/api/teachers/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ is_active: !isActive }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          setStatus(teachersStatus, json.error || 'Failed to update teacher.', 'error');
          return;
        }
        setStatus(teachersStatus, 'Teacher updated.', 'success');
        await loadTeachers();
      } catch (err) {
        console.error(err);
        setStatus(teachersStatus, 'Network error while updating teacher.', 'error');
      }
    }
  });

  refreshTeachersBtn.addEventListener('click', loadTeachers);

  // Export
  const exportAttendanceBtn = document.getElementById('export-attendance-btn');
  exportAttendanceBtn.addEventListener('click', () => {
    fetch('/api/attendance/export', {
      headers: { Authorization: 'Bearer ' + getToken() },
    })
      .then((resp) => resp.blob())
      .then((blob) => {
        const href = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = 'attendance-export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(href);
      })
      .catch((err) => console.error(err));
  });

  // Init
  window.addEventListener('load', () => {
    if (isStandalone()) {
      redirectToLogin();
      return;
    }
    if (!getToken()) {
      window.location.href = '/admin/login.html';
      return;
    }
    if (window.localStorage.getItem('teacherAccess') === 'scanner') {
      window.location.href = '/teacher/';
      return;
    }

    let inactivityTimer = null;
    function resetInactivityTimer() {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        redirectToLogin();
      }, INACTIVITY_MS);
    }
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach((ev) => {
      document.addEventListener(ev, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    const adminLabel = document.getElementById('admin-user-label');
    const teacherName = window.localStorage.getItem('teacherName') || 'Admin';
    adminLabel.textContent = `Logged in as ${teacherName}`;

    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        redirectToLogin();
      });
    }

    const welcomeNameEl = document.getElementById('welcome-name');
    const welcomeSubEl = document.getElementById('welcome-sub');
    if (welcomeNameEl) {
      const name = (teacherName || '').trim() || 'there';
      welcomeNameEl.textContent = name;
    }
    if (welcomeSubEl) {
      const funLines = [
        'Ready to make today smooth?',
        'Let\'s get those learners sorted.',
        'You\'ve got this!',
      ];
      welcomeSubEl.textContent = funLines[Math.floor(Math.random() * funLines.length)];
    }

    loadChildren();
    loadAttendanceToday();
    loadTeachers();
  });
})();


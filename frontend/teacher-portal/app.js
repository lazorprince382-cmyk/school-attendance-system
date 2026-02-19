(function () {
  const teacherNameEl = document.getElementById('teacher-name');
  const logoutBtn = document.getElementById('logout-btn');
  const overlayMessageEl = document.getElementById('overlay-message');
  const childMainLineEl = document.getElementById('child-main-line');
  const childSecondaryLineEl = document.getElementById('child-secondary-line');
  const statusMessageEl = document.getElementById('status-message');
  const btnRelease = document.getElementById('btn-release');
  const btnEmergencyRelease = document.getElementById('btn-emergency-release');
  const pickersRow = document.getElementById('pickers-row');
  const pickerZoomOverlay = document.getElementById('picker-zoom-overlay');
  const pickerZoomImg = document.getElementById('picker-zoom-img');
  const pickerZoomLabel = document.getElementById('picker-zoom-label');
  const btnScanAgain = document.getElementById('btn-scan-again');
  const scanFileInput = document.getElementById('scan-file-input');
  const appEl = document.querySelector('.app');

  let html5QrCode = null;
  let lastQrText = null;
  let lastChild = null;
  let selectedPickerId = null;
  let resetTimeout = null;

  const scannerConfig = {
    fps: 20,
    qrbox: (vw, vh) => {
      const side = Math.min(vw, vh) * 0.95;
      return { width: side, height: side };
    },
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: { exact: 'environment' },
    },
  };

  function getToken() {
    return window.localStorage.getItem('authToken') || '';
  }

  function requireAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = '/admin/login.html';
      return false;
    }
    if (window.localStorage.getItem('teacherAccess') === 'admin') {
      window.location.href = '/admin/';
      return false;
    }
    return true;
  }

  function initTeacherInfo() {
    const name = window.localStorage.getItem('teacherName') || 'Teacher';
    teacherNameEl.textContent = name;
  }

  function setStatus(message, type) {
    statusMessageEl.textContent = message;
    statusMessageEl.classList.remove('success', 'error', 'info');
    statusMessageEl.classList.add(type || 'info');
  }

  function setChildDetails(child, qrText) {
    if (child) {
      childMainLineEl.textContent = child.fullName || 'Unknown child';
      childSecondaryLineEl.textContent =
        (child.className ? child.className + ' · ' : '') +
        (child.schoolName || '');
    } else if (qrText) {
      childMainLineEl.textContent = 'Scanned: ' + qrText;
      childSecondaryLineEl.textContent = 'Looking up child...';
    } else {
      childMainLineEl.textContent = 'Waiting for QR scan...';
      childSecondaryLineEl.textContent = '-';
    }
  }

  function setReleaseButtonEnabled(enabled) {
    const canRelease = enabled && lastChild;
    if (btnRelease) btnRelease.disabled = !canRelease;
    if (btnEmergencyRelease) btnEmergencyRelease.disabled = !canRelease;
    const buttonsRow = btnRelease && btnRelease.closest('.buttons-row');
    if (buttonsRow) buttonsRow.classList.toggle('release-enabled', !!canRelease && selectedPickerId != null);
  }

  function openPickerZoom(photoUrl, name) {
    if (!pickerZoomOverlay || !pickerZoomImg || !pickerZoomLabel) return;
    pickerZoomImg.src = photoUrl;
    pickerZoomImg.alt = name || 'Picker';
    pickerZoomLabel.textContent = name || 'Authorized picker';
    pickerZoomOverlay.classList.add('is-open');
  }

  function closePickerZoom() {
    if (!pickerZoomOverlay) return;
    pickerZoomOverlay.classList.remove('is-open');
  }

  function initPickerZoomOverlay() {
    if (!pickerZoomOverlay) return;
    pickerZoomOverlay.addEventListener('click', closePickerZoom);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pickerZoomOverlay.classList.contains('is-open')) closePickerZoom();
    });
    pickersRow.addEventListener('click', (e) => {
      const selectBtn = e.target.closest('.picker-select-btn');
      if (selectBtn) {
        e.preventDefault();
        const slot = selectBtn.closest('.picker-slot');
        const pickerIdRaw = slot && slot.getAttribute('data-picker-id');
        if (pickerIdRaw != null && pickerIdRaw !== '') {
          const pickerId = Number(pickerIdRaw);
          if (pickerId === selectedPickerId) {
            selectedPickerId = null;
            slot.classList.remove('selected');
            selectBtn.textContent = 'Select';
            selectBtn.classList.remove('is-selected');
          } else {
            pickersRow.querySelectorAll('.picker-slot').forEach((s) => {
              s.classList.remove('selected');
              const btn = s.querySelector('.picker-select-btn');
              if (btn) {
                btn.textContent = 'Select';
                btn.classList.remove('is-selected');
              }
            });
            selectedPickerId = pickerId;
            slot.classList.add('selected');
            selectBtn.textContent = 'Picked';
            selectBtn.classList.add('is-selected');
          }
          setReleaseButtonEnabled(!!lastChild);
        }
        return;
      }
      const slot = e.target.closest('.picker-slot');
      if (!slot) return;
      const wrap = e.target.closest('.picker-photo-wrap');
      if (!wrap) return;
      const img = wrap.querySelector('img.picker-photo');
      if (!img || !img.src) return;
      const nameEl = slot.querySelector('.picker-name');
      const name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : 'Authorized picker';
      openPickerZoom(img.src, name === '-' ? 'Authorized picker' : name);
    });
  }

  function renderPickers(authorizedPickers) {
    selectedPickerId = null;
    const slots = pickersRow.querySelectorAll('.picker-slot');
    const list = authorizedPickers || [];
    const baseUrl = window.location.origin;
    for (let i = 0; i < 3; i += 1) {
      const slot = slots[i];
      if (!slot) continue;
      slot.classList.remove('selected');
      slot.removeAttribute('data-picker-id');
      const photoWrap = slot.querySelector('.picker-photo-wrap');
      const nameEl = slot.querySelector('.picker-name');
      const relEl = slot.querySelector('.picker-relationship');
      const picker = list[i];
      if (picker) {
        if (picker.id != null) slot.setAttribute('data-picker-id', String(picker.id));
        const photoUrl = picker.photoUrl
          ? (picker.photoUrl.startsWith('http') ? picker.photoUrl : baseUrl + picker.photoUrl)
          : '';
        photoWrap.innerHTML = '';
        if (photoUrl) {
          const img = document.createElement('img');
          img.src = photoUrl;
          img.alt = picker.name || 'Picker';
          img.className = 'picker-photo';
          img.onerror = () => {
            const span = document.createElement('span');
            span.className = 'picker-placeholder';
            span.textContent = 'No photo';
            photoWrap.appendChild(span);
          };
          photoWrap.appendChild(img);
          photoWrap.style.cursor = 'pointer';
        } else {
          const span = document.createElement('span');
          span.className = 'picker-placeholder';
          span.textContent = 'No photo';
          photoWrap.appendChild(span);
        }
        const displayName = (picker.name != null && String(picker.name).trim() !== '') ? String(picker.name).trim() : `Holder ${i + 1}`;
        nameEl.textContent = displayName;
        relEl.textContent = picker.relationship || '-';
        const selectBtn = slot.querySelector('.picker-select-btn');
        if (selectBtn) {
          selectBtn.textContent = 'Select';
          selectBtn.classList.remove('is-selected');
          selectBtn.style.display = '';
        }
      } else {
        photoWrap.innerHTML = '<span class="picker-placeholder">No photo</span>';
        photoWrap.style.cursor = 'default';
        nameEl.textContent = `Holder ${i + 1}`;
        relEl.textContent = '-';
        const selectBtn = slot.querySelector('.picker-select-btn');
        if (selectBtn) selectBtn.style.display = 'none';
      }
    }
    setReleaseButtonEnabled(!!lastChild);
  }

  initPickerZoomOverlay();

  function resetUI() {
    lastQrText = null;
    lastChild = null;
    selectedPickerId = null;
    setReleaseButtonEnabled(false);
    setChildDetails(null, null);
    renderPickers([]);
    setStatus('Ready for next scan.', 'info');
  }

  function scanAgain() {
    lastQrText = null;
    lastChild = null;
    selectedPickerId = null;
    setReleaseButtonEnabled(false);
    setChildDetails(null, null);
    renderPickers([]);
    setStatus('Point camera at QR code.', 'info');
  }

  function enterConfirmMode() {
    if (appEl) appEl.classList.add('confirm-mode');
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().catch(() => {});
    }
  }

  async function exitConfirmMode() {
    if (appEl) appEl.classList.remove('confirm-mode');
    scanAgain();
    if (html5QrCode) {
      try {
        await startScanner();
        setStatus('Camera active. Scan QR code.', 'info');
      } catch (err) {
        console.error('restart scanner error', err);
        setStatus('Camera could not restart.', 'error');
      }
    }
  }

  function logout() {
    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem('teacherName');
    window.location.href = '/admin/login.html';
  }

  logoutBtn.addEventListener('click', logout);

  /** Returns { child } on success, or { error, status } on failure so UI can show the right message. */
  async function fetchChildByQr(qrText) {
    try {
      const resp = await fetch(
        '/api/children/by-qr?code=' + encodeURIComponent(qrText),
        {
          headers: {
            Authorization: 'Bearer ' + getToken(),
          },
        }
      );
      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return { child: body };
      }
      return {
        error: body.error || resp.statusText || 'Request failed',
        status: resp.status,
      };
    } catch (err) {
      console.error('fetchChildByQr error', err);
      return { error: 'Network or server error. Check connection and try again.', status: 0 };
    }
  }

  async function submitRelease(emergencyRelease = false) {
    if (!lastChild || !lastChild.id) {
      setStatus('Scan a child QR first.', 'error');
      return;
    }

    try {
      setReleaseButtonEnabled(false);
      setStatus(emergencyRelease ? 'Recording emergency release...' : 'Recording departure...', 'info');
      const body = {
        childId: lastChild.id,
        action: 'OUT',
        timestamp: new Date().toISOString(),
        emergency: emergencyRelease,
        pickerId: selectedPickerId != null && selectedPickerId !== '' ? Number(selectedPickerId) : null,
      };
      const resp = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken(),
        },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(json.error || 'Failed to record release.', 'error');
        setReleaseButtonEnabled(true);
        return;
      }
      setStatus(emergencyRelease ? 'Child released (emergency). Ready for next scan.' : 'Child released. Ready for next scan.', 'success');
      if (resetTimeout) clearTimeout(resetTimeout);
      resetTimeout = setTimeout(() => {
        resetUI();
        exitConfirmMode();
      }, 2000);
    } catch (err) {
      console.error('submitRelease error', err);
      setStatus('Network error while recording release.', 'error');
      setReleaseButtonEnabled(true);
    }
  }

  if (btnRelease) btnRelease.addEventListener('click', () => submitRelease(false));
  if (btnEmergencyRelease) btnEmergencyRelease.addEventListener('click', () => submitRelease(true));

  if (btnScanAgain) btnScanAgain.addEventListener('click', () => exitConfirmMode());

  if (scanFileInput) {
    scanFileInput.addEventListener('change', (e) => {
      const file = e.target && e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file || !html5QrCode) return;
      setStatus('Reading image...', 'info');
      html5QrCode.scanFile(file, false)
        .then((decodedText) => {
          if (decodedText) onScanSuccess(decodedText);
          else setStatus('No QR code found in image.', 'error');
        })
        .catch((err) => {
          console.error('scanFile error', err);
          setStatus('Could not read QR from image.', 'error');
        });
    });
  }

  function triggerScanFeedback() {
    try {
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {
      // ignore
    }
  }

  async function onScanSuccess(qrText) {
    if (qrText === lastQrText) {
      setStatus('Same QR. Move away and scan again, or tap "Scan again".', 'info');
      return;
    }
    triggerScanFeedback();
    lastQrText = qrText;
    lastChild = null;
    setReleaseButtonEnabled(false);
    setStatus('QR scanned. Looking up child...', 'info');
    setChildDetails(null, qrText);
    renderPickers([]);

    const result = await fetchChildByQr(qrText);
    if (result.child) {
      lastChild = result.child;
      setChildDetails(result.child, qrText);
      renderPickers(result.child.authorizedPickers || []);
    } else {
      const msg =
        result.status === 401
          ? 'Session expired. Please log in again.'
          : result.status === 403
            ? 'You do not have scanner access.'
            : result.error || 'Child not found for this QR.';
      setStatus(msg, 'error');
      setChildDetails(null, qrText);
      renderPickers([]);
      return;
    }
    setReleaseButtonEnabled(!!lastChild);
    setStatus('Select who is picking, then confirm release.', 'info');
    enterConfirmMode();
  }

  function onScanFailure() {
    // ignore continuous scan errors
  }

  function preferBackCameraId(devices) {
    if (!devices || !devices.length) return null;
    const lower = (s) => (s || '').toLowerCase();
    const isFront = (d) =>
      lower(d.label).includes('front') || lower(d.label).includes('user') || lower(d.label).includes('selfie');
    const isBack = (d) =>
      lower(d.label).includes('back') || lower(d.label).includes('rear') || lower(d.label).includes('environment');
    const back = devices.find(isBack);
    if (back) return back.id;
    if (devices.length >= 2) {
      const front = devices.find(isFront);
      if (front && devices.length === 2) return devices[1].id;
      return devices[devices.length - 1].id;
    }
    return null;
  }

  async function getCameraRequest() {
    try {
      const devices = await Html5Qrcode.getCameras();
      const backId = preferBackCameraId(devices);
      if (backId) return backId;
    } catch (e) {
      // getCameras can fail; fall back to exact environment constraint
    }
    return { facingMode: { exact: 'environment' } };
  }

  async function startScanner() {
    const cameraRequest = await getCameraRequest();
    return html5QrCode.start(
      cameraRequest,
      scannerConfig,
      onScanSuccess,
      onScanFailure
    );
  }

  async function initQrScanner() {
    if (!requireAuth()) return;
    overlayMessageEl.textContent = 'Requesting camera permission...';
    try {
      html5QrCode = new Html5Qrcode('qr-reader');
      await startScanner();
      overlayMessageEl.style.display = 'none';
      setStatus('Camera active. Scan QR code.', 'info');
    } catch (err) {
      console.error('initQrScanner error', err);
      overlayMessageEl.textContent = 'Unable to access camera. Use Chrome, open this page over HTTPS, and allow camera when prompted.';
      setStatus('Camera error. Use Chrome and allow camera.', 'error');
    }
  }

  window.addEventListener('load', () => {
    initTeacherInfo();
    initQrScanner();
  });

  window.addEventListener('beforeunload', async () => {
    if (html5QrCode && html5QrCode.isScanning) {
      try {
        await html5QrCode.stop();
      } catch (e) {
        // ignore
      }
    }
  });
})();


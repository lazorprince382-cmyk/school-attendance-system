(function () {
  const form = document.getElementById('login-form');
  const phoneInput = document.getElementById('phone-input');
  const pinInput = document.getElementById('pin-input');
  const statusEl = document.getElementById('login-status');

  function setStatus(msg, type) {
    statusEl.textContent = msg || '';
    statusEl.classList.remove('success', 'error');
    if (type) statusEl.classList.add(type);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim();
    const pin = pinInput.value.trim();
    const target = (new FormData(form).get('target') || 'teacher').toString();

    if (!phone || !pin) {
      setStatus('Phone and PIN are required.', 'error');
      return;
    }

    try {
      setStatus('Logging in...', 'info');
      const resp = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, pin }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setStatus(json.error || 'Login failed.', 'error');
        return;
      }

      window.localStorage.setItem('authToken', json.token);
      window.localStorage.setItem('teacherName', json.teacher.name || 'Teacher');
      const access = json.teacher.access || 'both';
      window.localStorage.setItem('teacherAccess', access);

      setStatus('Login successful. Redirecting...', 'success');

      if (access === 'scanner') {
        window.location.href = '/teacher/';
      } else if (access === 'admin') {
        window.location.href = '/admin/';
      } else {
        if (target === 'teacher') {
          window.location.href = '/teacher/';
        } else {
          window.location.href = '/admin/';
        }
      }
    } catch (err) {
      console.error('Login error', err);
      setStatus('Network error during login.', 'error');
    }
  });
})();


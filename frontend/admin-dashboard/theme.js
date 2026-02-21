(function () {
  var STORAGE_KEY = 'attendance-theme';
  var root = document.documentElement;

  function getDefaultTheme() {
    return 'light';
  }

  function getTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'dark' || stored === 'light' ? stored : getDefaultTheme();
    } catch (e) {
      return getDefaultTheme();
    }
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(theme);
    }
  }

  function toggleTheme() {
    var current = getTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  function init() {
    var theme = getTheme();
    root.setAttribute('data-theme', theme);
  }

  // Apply as early as possible to avoid flash
  init();

  window.getTheme = getTheme;
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        toggleTheme();
      });
      btn.setAttribute('aria-label', getTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  });
})();

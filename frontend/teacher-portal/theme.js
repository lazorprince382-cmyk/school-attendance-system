(function () {
  var STORAGE_KEY = 'attendance-theme';
  var root = document.documentElement;

  function getDefaultTheme() {
    var app = root.getAttribute('data-app');
    return app === 'teacher' ? 'dark' : 'light';
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

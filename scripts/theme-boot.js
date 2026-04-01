(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(window.location.search);
  var forcedTheme = params.get('theme');
  var isPdfExport = params.get('pdf') === '1';
  var storedTheme = null;

  try {
    storedTheme = localStorage.getItem('theme-preference');
  } catch (error) {}

  var theme = forcedTheme || storedTheme || 'light';

  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');

  if (isPdfExport) {
    root.classList.add('export-pdf');
  }
})();

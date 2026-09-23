(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(window.location.search);
  var forcedTheme = params.get('theme');
  var isPdfExport = params.get('pdf') === '1';
  var storedTheme = null;

  try {
    storedTheme = localStorage.getItem('theme-preference');
  } catch (error) {}

  var systemPrefersDark = false;
  try { systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  var theme = forcedTheme || storedTheme || (systemPrefersDark ? 'dark' : 'light');

  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');

  if (isPdfExport) {
    root.classList.add('export-pdf');
  }

  // Printing the resume from the browser uses the same layout as the generated PDF.
  window.addEventListener('beforeprint', function () {
    if (document.body.classList.contains('page-resume')) {
      root.classList.add('export-pdf');
    }
  });
  window.addEventListener('afterprint', function () {
    if (!isPdfExport) {
      root.classList.remove('export-pdf');
    }
  });
})();
